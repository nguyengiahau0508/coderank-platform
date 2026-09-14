import {
  Component,
  ChangeDetectionStrategy,
  signal,
  inject,
  ElementRef,
  viewChild,
  effect,
  computed,
  NgZone,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';

import {
  AgentApi,
  AiConfigModel,
  ConversationModel,
  ConversationMessageModel,
  getModelsForProvider,
  addCustomModel,
  removeCustomModel,
  getCustomModels,
  DEFAULT_AI_PROVIDER_MODELS,
} from '../../../data/domains/agent/api/agent.api';
import { AiProviderEnum } from '../../../data/shared/enums/enums';
import { environment } from '../../../../environments/environment';
import { ChatContextService } from '../../../core/services/chat-context.service';
import { AiUserPreferencesService } from '../../../core/services/ai-user-preferences.service';
import { AuthService } from '../../../core/services/auth.service';

/** Provider display metadata */
const PROVIDER_META: Record<AiProviderEnum, { label: string; icon: string; color: string }> = {
  [AiProviderEnum.Gemini]: { label: 'Gemini', icon: 'pi pi-sparkles', color: '#4285F4' },
  [AiProviderEnum.OpenAI]: { label: 'OpenAI', icon: 'pi pi-star', color: '#10A37F' },
  [AiProviderEnum.Anthropic]: { label: 'Anthropic', icon: 'pi pi-compass', color: '#D97706' },
  [AiProviderEnum.Groq]: { label: 'Groq', icon: 'pi pi-bolt', color: '#F55036' },
  [AiProviderEnum.Ollama]: { label: 'Ollama', icon: 'pi pi-server', color: '#7C3AED' },
};

@Component({
  selector: 'app-ai-chat',
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ai-chat.component.html',
  styleUrl: './ai-chat.component.css',
})
export class AiChatComponent {
  private readonly agentApi = inject(AgentApi);
  private readonly ngZone = inject(NgZone);
  private readonly chatContextService = inject(ChatContextService);
  private readonly aiPreferences = inject(AiUserPreferencesService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly messagesEl = viewChild<ElementRef<HTMLElement>>('messagesContainer');

  // UI state
  isOpen = signal(false);
  sidebarOpen = signal(true);
  showConfig = signal(false);
  chatSize = signal<'mini' | 'resizable' | 'maximum'>('mini');

  // Resize state (for resizable mode)
  resizeWidth = signal(620);
  resizeHeight = signal(660);
  private isResizing = false;
  private resizeStartX = 0;
  private resizeStartY = 0;
  private resizeStartW = 0;
  private resizeStartH = 0;
  private resizeEdge: 'top' | 'left' | 'top-left' = 'top-left';
  private boundResizeMove = this.onResizeMove.bind(this);
  private boundResizeEnd = this.onResizeEnd.bind(this);

  // Conversations
  conversations = signal<ConversationModel[]>([]);
  activeConversationId = signal<string | null>(null);
  messages = signal<ConversationMessageModel[]>([]);
  editingConvId = signal<string | null>(null);
  editingConvTitle = '';

  // Streaming
  isStreaming = signal(false);
  streamingContent = signal('');
  streamingStatus = signal('');

  // Input
  inputMessage = '';

  // Provider configs
  providerConfigs = signal<AiConfigModel[]>([]);
  activeProvider = signal<AiProviderEnum | null>(null);
  isSavingConfig = signal(false);

  // Quick switcher & in-chat config state
  showModelQuickSelect = signal(false);
  showApiKey = signal(false);
  configSuccessMsg = signal('');
  configErrorMsg = signal('');

  // Editing provider state
  editingProvider = signal<AiProviderEnum>(AiProviderEnum.Gemini);
  editModel = signal<string>('');
  editApiKey = signal<string>('');
  editBaseHost = signal<string>('');

  // Custom model management
  showAddModel = signal(false);
  newModelName = signal('');

  // Context toggle - user chooses to include context or not
  readonly includeContext = this.aiPreferences.includeContext;

  providers = Object.values(AiProviderEnum);

  activeProviderConfigured = computed(() => {
    const active = this.activeProvider();
    if (!active) return false;
    return this.providerConfigs().some(c => c.provider === active);
  });

  activeConversation = computed(() => {
    const id = this.activeConversationId();
    if (!id) return null;
    return this.conversations().find(c => c.id === id) ?? null;
  });

  // Context awareness
  readonly currentContext = this.chatContextService.currentContext;
  readonly contextSummary = this.chatContextService.contextSummary;
  readonly hasContext = this.chatContextService.hasContext;

  quickQuestions = [
    'How to solve Two Sum?',
    'Explain Big-O notation',
    'Debug my code',
    'What is dynamic programming?',
  ];

  constructor() {
    this.configureMarked();

    effect(() => {
      this.messages();
      this.isStreaming();
      this.streamingContent();
      setTimeout(() => this.scrollToBottom(), 50);
    });
  }

  // ---- Open / Close ----

  open() {
    this.setSize('mini');
    this.isOpen.set(true);
    this.loadConfigs();
    this.loadConversations();
  }

  close() {
    this.isOpen.set(false);
  }

  // ---- Size Modes ----

  setSize(size: 'mini' | 'resizable' | 'maximum') {
    this.chatSize.set(size);
    if (size === 'mini') {
      this.sidebarOpen.set(false);
    }
  }

  getSizeIcon(): string {
    switch (this.chatSize()) {
      case 'mini': return 'pi pi-minus';
      case 'resizable': return 'pi pi-stop';
      case 'maximum': return 'pi pi-window-maximize';
    }
  }

  // ---- Resize Drag ----

  onResizeStart(event: MouseEvent, edge: 'top' | 'left' | 'top-left') {
    event.preventDefault();
    this.isResizing = true;
    this.resizeEdge = edge;
    this.resizeStartX = event.clientX;
    this.resizeStartY = event.clientY;
    this.resizeStartW = this.resizeWidth();
    this.resizeStartH = this.resizeHeight();
    document.addEventListener('mousemove', this.boundResizeMove);
    document.addEventListener('mouseup', this.boundResizeEnd);
  }

  private onResizeMove(event: MouseEvent) {
    if (!this.isResizing) return;
    const dx = this.resizeStartX - event.clientX;
    const dy = this.resizeStartY - event.clientY;
    this.ngZone.run(() => {
      if (this.resizeEdge === 'left' || this.resizeEdge === 'top-left') {
        this.resizeWidth.set(Math.max(400, Math.min(this.resizeStartW + dx, window.innerWidth - 40)));
      }
      if (this.resizeEdge === 'top' || this.resizeEdge === 'top-left') {
        this.resizeHeight.set(Math.max(350, Math.min(this.resizeStartH + dy, window.innerHeight - 40)));
      }
    });
  }

  private onResizeEnd() {
    this.isResizing = false;
    document.removeEventListener('mousemove', this.boundResizeMove);
    document.removeEventListener('mouseup', this.boundResizeEnd);
  }

  // ---- Conversations ----

  newChat() {
    this.activeConversationId.set(null);
    this.messages.set([]);
    this.streamingContent.set('');
    this.streamingStatus.set('');
  }

  selectConversation(id: string) {
    if (this.activeConversationId() === id) return;
    this.activeConversationId.set(id);
    this.messages.set([]);
    this.streamingContent.set('');
    this.streamingStatus.set('');

    this.agentApi.getConversation(id).subscribe({
      next: (res) => {
        const conv = res.data;
        if (conv?.messages) {
          this.messages.set(conv.messages);
        }
      },
    });
  }

  startRenaming(conv: ConversationModel, event: Event) {
    event.stopPropagation();
    this.editingConvId.set(conv.id);
    this.editingConvTitle = conv.title;
  }

  saveRename(id: string) {
    const title = this.editingConvTitle.trim();
    if (!title) {
      this.editingConvId.set(null);
      return;
    }
    this.agentApi.updateConversation(id, title).subscribe({
      next: (res) => {
        if (res.data) {
          this.conversations.update(list =>
            list.map(c => c.id === id ? { ...c, title: res.data!.title } : c),
          );
        }
        this.editingConvId.set(null);
      },
      error: () => this.editingConvId.set(null),
    });
  }

  cancelRename() {
    this.editingConvId.set(null);
  }

  deleteConversation(id: string, event: Event) {
    event.stopPropagation();
    this.agentApi.deleteConversation(id).subscribe({
      next: () => {
        this.conversations.update(list => list.filter(c => c.id !== id));
        if (this.activeConversationId() === id) {
          this.newChat();
        }
      },
    });
  }

  // ---- Messages ----

  sendQuick(question: string) {
    this.inputMessage = question;
    this.sendMessage();
  }

  onEnterKey(event: Event) {
    const ke = event as KeyboardEvent;
    if (!ke.shiftKey) {
      ke.preventDefault();
      this.sendMessage();
    }
  }

  async sendMessage() {
    const text = this.inputMessage.trim();
    if (!text || this.isStreaming() || !this.activeProviderConfigured()) return;

    this.inputMessage = '';

    // Add user message to UI immediately
    const userMsg: ConversationMessageModel = {
      id: crypto.randomUUID(),
      conversationId: this.activeConversationId() || '',
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };
    this.messages.update(msgs => [...msgs, userMsg]);

    // Create conversation if needed
    let conversationId = this.activeConversationId();
    if (!conversationId) {
      try {
        const res = await new Promise<any>((resolve, reject) => {
          this.agentApi.createConversation().subscribe({ next: resolve, error: reject });
        });
        conversationId = res.data?.id;
        if (conversationId) {
          this.activeConversationId.set(conversationId);
          // Refresh conversation list
          this.loadConversations();
        }
      } catch {
        this.messages.update(msgs => [...msgs, {
          id: crypto.randomUUID(), conversationId: '', role: 'assistant' as const,
          content: 'Failed to create conversation. Please try again.',
          createdAt: new Date().toISOString(),
        }]);
        return;
      }
    }

    if (!conversationId) return;

    // Stream the response
    await this.streamResponse(conversationId, text);
  }

  // ---- Streaming ----

  private async streamResponse(conversationId: string, message: string) {
    this.isStreaming.set(true);
    this.streamingContent.set('');
    this.streamingStatus.set('');

    const token = localStorage.getItem('access_token');
    const url = `${environment.apiUrl}/agent/conversations/${encodeURIComponent(conversationId)}/messages`;

    // Only include context if user explicitly enabled it
    const context = this.includeContext() ? this.currentContext() : null;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          message,
          provider: this.activeProvider(),
          context: context ?? undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        // Keep the last potentially incomplete line in the buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          try {
            const data = JSON.parse(line.substring(6));

            this.ngZone.run(() => {
              switch (data.type) {
                case 'status':
                  this.streamingStatus.set(data.content || '');
                  break;
                case 'token':
                  fullContent += data.content;
                  this.streamingContent.set(fullContent);
                  this.streamingStatus.set('');
                  break;
                case 'done':
                  this.finishStreaming(conversationId, fullContent);
                  break;
                case 'error':
                  this.finishStreaming(conversationId,
                    fullContent || 'Sorry, an error occurred. Please try again.');
                  break;
              }
            });
          } catch {}
        }
      }

      // If stream ended without 'done' event, finalize with what we have
      if (this.isStreaming()) {
        this.ngZone.run(() => {
          this.finishStreaming(conversationId, fullContent || 'Response ended unexpectedly.');
        });
      }
    } catch (err: any) {
      this.ngZone.run(() => {
        this.finishStreaming(conversationId, 'Connection error. Please try again.');
      });
    }

    // Refresh conversation list to update titles
    this.loadConversations();
  }

  private finishStreaming(conversationId: string, content: string) {
    this.messages.update(msgs => [...msgs, {
      id: crypto.randomUUID(),
      conversationId,
      role: 'assistant' as const,
      content,
      createdAt: new Date().toISOString(),
    }]);
    this.isStreaming.set(false);
    this.streamingContent.set('');
    this.streamingStatus.set('');
  }

  // ---- Textarea ----

  autoResize(event: Event) {
    const textarea = event.target as HTMLTextAreaElement;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
  }

  // ---- Markdown ----

  renderMarkdown(content: string): string {
    const html = marked.parse(content, { async: false }) as string;
    return DOMPurify.sanitize(html);
  }

  onMessagesClick(event: Event) {
    const target = event.target as HTMLElement;
    const copyBtn = target.closest('.code-copy-btn') as HTMLElement | null;
    if (!copyBtn) return;
    const wrapper = copyBtn.closest('.code-block-wrapper');
    const pre = wrapper?.querySelector('pre');
    if (pre) {
      navigator.clipboard.writeText(pre.textContent || '');
      const span = copyBtn.querySelector('span');
      const icon = copyBtn.querySelector('i');
      if (span && icon) {
        span.textContent = 'Copied!';
        icon.className = 'pi pi-check';
        setTimeout(() => {
          span.textContent = 'Copy';
          icon.className = 'pi pi-copy';
        }, 2000);
      }
    }
  }

  // ---- Provider Config ----

  getProviderMeta(provider: AiProviderEnum) {
    return PROVIDER_META[provider];
  }

  getProviderModels(provider: AiProviderEnum): string[] {
    return getModelsForProvider(provider);
  }

  isCustomModel(provider: AiProviderEnum, model: string): boolean {
    const defaults = DEFAULT_AI_PROVIDER_MODELS[provider] ?? [];
    return !defaults.includes(model);
  }

  openAddModel() {
    this.showAddModel.set(true);
    this.newModelName.set('');
  }

  closeAddModel() {
    this.showAddModel.set(false);
    this.newModelName.set('');
  }

  addNewModel() {
    const provider = this.editingProvider();
    const name = this.newModelName().trim();
    if (!provider || !name) return;

    addCustomModel(provider, name);
    this.editModel.set(name);
    this.closeAddModel();
  }

  removeModel(model: string) {
    const provider = this.editingProvider();
    if (!provider) return;

    removeCustomModel(provider, model);
    // If removed model was selected, select first available
    if (this.editModel() === model) {
      const models = this.getProviderModels(provider);
      this.editModel.set(models[0] ?? '');
    }
  }

  isProviderConfigured(provider: AiProviderEnum): boolean {
    return this.providerConfigs().some(c => c.provider === provider);
  }

  getProviderModel(provider: AiProviderEnum): string | undefined {
    return this.providerConfigs().find(c => c.provider === provider)?.modelName;
  }

  onProviderCardClick(provider: AiProviderEnum) {
    if (this.isProviderConfigured(provider)) {
      this.setActiveProvider(provider);
    } else {
      this.openEditProvider(provider);
    }
  }

  toggleContext() {
    this.aiPreferences.setIncludeContext(!this.includeContext());
  }

  openAiSettings() {
    this.configSuccessMsg.set('');
    this.configErrorMsg.set('');
    this.showModelQuickSelect.set(false);
    const initial = this.activeProvider() || AiProviderEnum.Gemini;
    this.selectConfigProvider(initial);
    this.showConfig.set(true);
  }

  closeAiSettings() {
    this.showConfig.set(false);
    this.configSuccessMsg.set('');
    this.configErrorMsg.set('');
    this.showModelQuickSelect.set(false);
  }

  toggleModelQuickSelect() {
    this.showModelQuickSelect.update((v) => !v);
  }

  selectQuickProvider(provider: AiProviderEnum) {
    if (this.isProviderConfigured(provider)) {
      this.setActiveProvider(provider);
      this.showModelQuickSelect.set(false);
    } else {
      this.showModelQuickSelect.set(false);
      this.openEditProvider(provider);
    }
  }

  selectConfigProvider(provider: AiProviderEnum) {
    this.editingProvider.set(provider);
    this.configSuccessMsg.set('');
    this.configErrorMsg.set('');
    this.showApiKey.set(false);
    const existing = this.providerConfigs().find((c) => c.provider === provider);
    const models = this.getProviderModels(provider);
    this.editModel.set(existing?.modelName || models[0] || '');
    this.editApiKey.set('');
    this.editBaseHost.set(
      existing?.baseHost || (provider === AiProviderEnum.Ollama ? 'http://localhost:11434' : ''),
    );
  }

  getProviderDocUrl(provider: AiProviderEnum): string {
    switch (provider) {
      case AiProviderEnum.Gemini:
        return 'https://aistudio.google.com/app/apikey';
      case AiProviderEnum.OpenAI:
        return 'https://platform.openai.com/api-keys';
      case AiProviderEnum.Anthropic:
        return 'https://console.anthropic.com/settings/keys';
      case AiProviderEnum.Groq:
        return 'https://console.groq.com/keys';
      case AiProviderEnum.Ollama:
        return 'https://ollama.com/download';
      default:
        return '';
    }
  }

  openEditProvider(provider: AiProviderEnum, event?: Event) {
    event?.stopPropagation();
    this.selectConfigProvider(provider);
    this.showConfig.set(true);
  }

  saveProviderConfig() {
    const provider = this.editingProvider();
    if (!provider) return;

    const model = this.editModel().trim();
    if (!model) {
      this.configErrorMsg.set('Vui lòng chọn hoặc nhập Model.');
      return;
    }

    this.isSavingConfig.set(true);
    this.configSuccessMsg.set('');
    this.configErrorMsg.set('');

    const dto = {
      provider,
      modelName: model,
      apiKey: this.editApiKey().trim() || undefined,
      baseHost: this.editBaseHost().trim() || undefined,
    };

    this.agentApi.upsertConfig(dto).subscribe({
      next: (response) => {
        const saved = response.data!;
        this.providerConfigs.update((configs) => {
          const idx = configs.findIndex((c) => c.provider === provider);
          if (idx >= 0) {
            const updated = [...configs];
            updated[idx] = saved;
            return updated;
          }
          return [...configs, saved];
        });
        this.setActiveProvider(provider);
        this.isSavingConfig.set(false);
        this.configSuccessMsg.set(
          `Đã lưu cấu hình cho ${this.getProviderMeta(provider).label} thành công!`,
        );
        this.editApiKey.set('');
      },
      error: (err) => {
        this.isSavingConfig.set(false);
        this.configErrorMsg.set(
          err?.error?.error || 'Lỗi khi lưu cấu hình. Vui lòng kiểm tra lại.',
        );
      },
    });
  }

  deleteProviderConfig(provider: AiProviderEnum, event?: Event) {
    event?.stopPropagation();
    this.configSuccessMsg.set('');
    this.configErrorMsg.set('');
    this.agentApi.deleteConfig(provider).subscribe({
      next: () => {
        this.providerConfigs.update((configs) =>
          configs.filter((c) => c.provider !== provider),
        );
        if (this.activeProvider() === provider) {
          const remaining = this.providerConfigs();
          this.setActiveProvider(
            remaining.length > 0 ? remaining[0].provider : null,
          );
        }
        this.configSuccessMsg.set(
          `Đã xóa cấu hình ${this.getProviderMeta(provider).label}.`,
        );
        this.selectConfigProvider(provider);
      },
      error: (err) => {
        this.configErrorMsg.set(err?.error?.error || 'Không thể xóa cấu hình.');
      },
    });
  }

  // ---- Private ----

  private loadConfigs() {
    this.agentApi.getConfigs().subscribe({
      next: (response) => {
        const configs = response.data ?? [];
        this.providerConfigs.set(configs);
        const preferred = this.aiPreferences.preferredProvider();
        const preferredValid = preferred && configs.some(item => item.provider === preferred);
        if (preferredValid && preferred) {
          this.setActiveProvider(preferred);
        } else if (configs.length > 0 && !this.activeProvider()) {
          this.setActiveProvider(configs[0].provider);
        }
      },
    });
  }

  private loadConversations() {
    this.agentApi.getConversations().subscribe({
      next: (response) => {
        this.conversations.set(response.data ?? []);
      },
    });
  }

  private scrollToBottom() {
    const el = this.messagesEl()?.nativeElement;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }

  private setActiveProvider(provider: AiProviderEnum | null) {
    this.activeProvider.set(provider);
    this.aiPreferences.setPreferredProvider(provider);
  }

  private configureMarked() {
    marked.use({
      renderer: {
        code({ text, lang }) {
          const language = lang || '';
          const displayLang = language || 'code';
          let highlighted: string;
          if (language && hljs.getLanguage(language)) {
            highlighted = hljs.highlight(text, { language }).value;
          } else {
            highlighted = hljs.highlightAuto(text).value;
          }
          return `<div class="code-block-wrapper"><div class="code-block-header"><span class="code-lang">${displayLang}</span><button class="code-copy-btn" type="button"><i class="pi pi-copy"></i><span>Copy</span></button></div><pre><code class="hljs">${highlighted}</code></pre></div>`;
        },
      },
    });
  }
}
