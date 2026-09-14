import { ITool } from './tool.interface';

export class ToolRegistry {
  private tools = new Map<string, ITool>();

  register(tool: ITool): this {
    this.tools.set(tool.name, tool);
    return this;
  }

  registerMany(tools: ITool[]): this {
    tools.forEach(tool => this.register(tool));
    return this;
  }

  get(name: string): ITool | undefined {
    return this.tools.get(name);
  }

  getAll(): ITool[] {
    return Array.from(this.tools.values());
  }
}
