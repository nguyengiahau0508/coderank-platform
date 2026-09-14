import { createInternalClient } from '../../api/api-client';
import { LLMFactory, LLMProviderType } from '../llm/llm.factory';
import type { ILLMConfig } from '../llm/llm.interface';
import { promisify } from 'util';
import { execFile } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const execFileAsync = promisify(execFile);

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.angular',
  '.vscode',
  '.idea',
  'coverage',
  'vendor',
  '.dart_tool',
  '.gradle',
  'target',
  'bin',
  'obj',
]);

const READABLE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.txt',
  '.yml',
  '.yaml',
  '.xml',
  '.html',
  '.css',
  '.scss',
  '.sass',
  '.less',
  '.java',
  '.kt',
  '.py',
  '.cpp',
  '.cc',
  '.cxx',
  '.c',
  '.h',
  '.hpp',
  '.cs',
  '.go',
  '.rs',
  '.php',
  '.rb',
  '.swift',
  '.sql',
  '.sh',
  '.bash',
  '.zsh',
  '.bat',
  '.ps1',
  '.env',
  '.ini',
  '.toml',
  '.vue',
  '.svelte',
  '.gradle',
  '.properties',
  '.dart',
]);

const CODE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.java',
  '.kt',
  '.py',
  '.cpp',
  '.cc',
  '.cxx',
  '.c',
  '.h',
  '.hpp',
  '.cs',
  '.go',
  '.rs',
  '.php',
  '.rb',
  '.swift',
  '.vue',
  '.svelte',
  '.dart',
]);

const JAVASCRIPT_TYPESCRIPT_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.vue',
  '.svelte',
]);
const PYTHON_EXTENSIONS = new Set(['.py']);
const JVM_EXTENSIONS = new Set(['.java', '.kt']);
const DOTNET_EXTENSIONS = new Set(['.cs']);
const GO_EXTENSIONS = new Set(['.go']);
const RUST_EXTENSIONS = new Set(['.rs']);
const PHP_EXTENSIONS = new Set(['.php']);
const CPP_C_EXTENSIONS = new Set(['.cpp', '.cc', '.cxx', '.c', '.h', '.hpp']);

const METADATA_BASENAMES = new Set([
  'package.json',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lock',
  'bun.lockb',
  'composer.json',
  'composer.lock',
  'cargo.toml',
  'cargo.lock',
  'go.mod',
  'go.sum',
  'pom.xml',
  'build.gradle',
  'settings.gradle',
  'gradle.properties',
  'tsconfig.json',
  'pubspec.yaml',
  'analysis_options.yaml',
  '.gitignore',
  '.gitattributes',
  'readme.md',
  'readme.txt',
  'license',
  'license.md',
  'license.txt',
]);

const METADATA_EXTENSIONS = new Set([
  '.md',
  '.txt',
  '.yaml',
  '.yml',
  '.toml',
  '.ini',
  '.lock',
]);

const MAX_FILES_PER_SUBMISSION = 120;
const MAX_FILE_BYTES = 500 * 1024;
const MAX_FILE_CHARS = 12000;
const MAX_TOTAL_CHARS = 180000;
const MAX_SIMILARITY_MATCHES = 5;
const MIN_SIMILARITY_TOKEN_COUNT = 40;
const MAX_RAW_RESPONSE_CHARS_FOR_REPAIR = 20000;
const MAX_FILES_FOR_AI_GRADING = 14;
const MAX_FILE_SELECTION_PREVIEW_CHARS = 500;
const MAX_PATHS_FOR_PROJECT_INFERENCE = 220;
const MAX_PATHS_FOR_SELECTION_MANIFEST = 180;
const MIN_IMPLEMENTATION_FILES_FOR_GRADING = 4;
const MAX_METADATA_FILES_FOR_GRADING = 1;
const MAX_FILES_FOR_TRAVERSAL = 48;
const MIN_FILES_BEFORE_EARLY_STOP = 2;
const MIN_IMPLEMENTATION_FILES_BEFORE_EARLY_STOP = 1;
const DOWNLOAD_REQUEST_TIMEOUT_MS = 25000;
const LLM_REQUEST_TIMEOUT_MS = 45000;
const OLLAMA_LLM_REQUEST_TIMEOUT_MS = 90000;
const MAX_RETRY_ATTEMPTS = 3;
const OLLAMA_MAX_RETRY_ATTEMPTS = 4;
const RETRY_BASE_DELAY_MS = 350;
const ZIP_LIST_MAX_BUFFER = 20 * 1024 * 1024;
const MAX_CONCURRENT_SUBMISSION_GRADING = 3;
const MAX_ADAPTIVE_DECISION_PARSE_FAILURES = 2;
const MAX_FILES_FOR_OLLAMA_GRADING = 8;

type SubmissionFileInfo = {
  fileId: string;
  filePath: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
};

type CourseAssignmentSubmission = {
  id: string;
  assignmentId: string;
  authorId: string;
  content?: string;
  submissionFiles?: SubmissionFileInfo[];
  status: string;
  attemptNumber: number;
  submittedAt: string;
};

type GradingCriterion = {
  criterion: string;
  description?: string;
  maxScore: number;
};

type SubmissionFileSnippet = {
  relativePath: string;
  content: string;
  includeInSimilarity: boolean;
  isMetadata: boolean;
};

type SubmissionPreparedData = {
  submission: CourseAssignmentSubmission;
  snippets: SubmissionFileSnippet[];
  similarityTokens: Set<string>;
  combinedSource: string;
};

type GradeRequestPayload = {
  userToken: string;
  role?: string;
  provider?: string;
  modelName?: string;
  apiKey?: string;
  baseHost?: string;
  courseId: string;
  lessonId: string;
  assignmentId: string;
  submissionIds?: string[];
  similarityThreshold?: number;
  defaultMaxScore?: number;
  gradingCriteria?: GradingCriterion[];
  assignmentTitle?: string;
  assignmentDescription?: string;
};

type LlmCriterionScore = {
  criterion: string;
  maxScore: number;
  score: number;
  feedback?: string;
};

type LlmGradeJson = {
  criterionScores?: Array<{
    criterion: string;
    score: number;
    feedback?: string;
  }>;
  totalScore?: number;
  feedback?: string;
  strengths?: string[];
  improvements?: string[];
  confidence?: number;
};

type LlmFileSelectionJson = {
  selectedFiles?: string[];
};

type LlmProjectContextJson = {
  projectType?: string;
  keyDirectories?: string[];
  prioritizePatterns?: string[];
  deprioritizePatterns?: string[];
  implementationExtensions?: string[];
};

type LlmReadDecisionJson = {
  needsMoreFiles?: boolean;
  reason?: string;
  confidence?: number;
  missingEvidence?: string[];
};

type LlmProvider = ReturnType<typeof LLMFactory.createProviderWithFallback>['provider'];

type InferredProjectContext = {
  projectType: string;
  keyDirectories: string[];
  prioritizePatterns: string[];
  deprioritizePatterns: string[];
  implementationExtensions: string[];
  source: 'heuristic' | 'llm';
};

type BatchGradeResult = {
  assignmentId: string;
  gradedCount: number;
  flaggedCount: number;
  results: Array<{
    submissionId: string;
    status: string;
    score?: number;
    feedback?: string;
    isSimilarityFlagged: boolean;
    maxSimilarityScore?: number;
    similarityMatches: Array<{
      submissionId: string;
      authorId: string;
      similarity: number;
    }>;
    aiGradingResult: {
      rubricUsed: GradingCriterion[];
      criterionScores?: LlmCriterionScore[];
      score: number;
      maxScore: number;
      percentageScore: number;
      feedback: string;
      strengths: string[];
      improvements: string[];
      confidence: number;
      evaluatedFileCount: number;
      generatedAt: string;
      graderProvider?: string;
      graderModel?: string;
      error?: string;
    };
  }>;
};

const ASSIGNMENT_GRADING_SYSTEM_PROMPT = `You are an assignment grading assistant.
You will grade student project submissions using provided rubric criteria.
Return JSON only, no markdown, no code fences, no extra commentary.`;

const FILE_SELECTION_SYSTEM_PROMPT = `You select the most relevant files for grading.
Prefer student-authored implementation files, avoid generated or scaffolding files.
Return JSON only.`;

const PROJECT_CONTEXT_SYSTEM_PROMPT = `You infer project type and grading-relevant areas from file paths.
Return JSON only.`;

const ADAPTIVE_READING_SYSTEM_PROMPT = `You are controlling adaptive file reading for assignment grading.
After each file, decide whether more files are needed before grading.
Be conservative: if uncertain, require more files.
Return JSON only.`;

const unwrapApiData = <T>(payload: unknown): T => {
  if (
    payload &&
    typeof payload === 'object' &&
    'data' in payload &&
    (payload as any).data !== undefined
  ) {
    return (payload as any).data as T;
  }
  return payload as T;
};

const safeFileName = (fileName: string): string =>
  fileName.replace(/[^a-zA-Z0-9._-]/g, '_');

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const toNumber = (value: unknown, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return fallback;
};

const wait = (delayMs: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, delayMs));

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const withTimeout = async <T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> => {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`${label} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
};

const isRetryableError = (error: unknown): boolean => {
  const value = error as any;
  const message = String(value?.message || '').toLowerCase();
  const code = String(value?.code || '').toUpperCase();
  const status = Number(value?.response?.status ?? value?.status ?? value?.status_code);

  if (
    [
      'ETIMEDOUT',
      'ECONNRESET',
      'ECONNABORTED',
      'EAI_AGAIN',
      'ENOTFOUND',
      'ECONNREFUSED',
      'EPIPE',
    ].includes(code)
  ) {
    return true;
  }

  if (Number.isFinite(status) && (status >= 500 || status === 429 || status === 408)) {
    return true;
  }

  return (
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('rate limit') ||
    message.includes('temporarily unavailable') ||
    message.includes('network') ||
    message.includes('connection reset by peer') ||
    message.includes('socket hang up') ||
    message.includes('unexpected end of json input') ||
    message.includes('read tcp')
  );
};

const normalizeConfidenceValue = (value: number): number => {
  const scaled = value > 1 && value <= 100 ? value / 100 : value;
  return Number(clamp(scaled, 0, 1).toFixed(3));
};

const normalizeForSimilarity = (source: string): string =>
  source
    .toLowerCase()
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/#.*$/gm, '')
    .replace(/\s+/g, ' ')
    .trim();

const tokenize = (source: string): Set<string> => {
  if (!source) {
    return new Set();
  }

  const tokens = source
    .split(/[^a-z0-9_]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);

  return new Set(tokens);
};

const jaccardSimilarity = (left: Set<string>, right: Set<string>): number => {
  if (left.size === 0 && right.size === 0) return 0;
  if (left.size === 0 || right.size === 0) return 0;

  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) {
      intersection++;
    }
  }
  const union = left.size + right.size - intersection;
  return union === 0 ? 0 : intersection / union;
};

const normalizePathForMatch = (value: string): string =>
  value.replace(/\\/g, '/').toLowerCase().trim();

const normalizePattern = (value: string): string =>
  normalizePathForMatch(value);

const uniqueStrings = (values: string[]): string[] =>
  Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item) => typeof item === 'string').map((item) => String(item))
    : [];

const matchesAnyPattern = (relativePath: string, patterns: string[]): boolean => {
  if (patterns.length === 0) return false;
  const normalizedPath = normalizePathForMatch(relativePath);

  return patterns.some((rawPattern) => {
    const pattern = normalizePattern(rawPattern);
    if (!pattern) return false;

    const compact = pattern.replace(/^\//, '');
    if (pattern.endsWith('/')) {
      return normalizedPath.includes(compact);
    }
    if (pattern.startsWith('.')) {
      return normalizedPath.endsWith(pattern);
    }
    return (
      normalizedPath === compact ||
      normalizedPath.endsWith(`/${compact}`) ||
      normalizedPath.includes(compact)
    );
  });
};

const isMetadataPath = (relativePath: string): boolean => {
  const normalized = normalizePathForMatch(relativePath);
  const baseName = path.basename(normalized);
  if (METADATA_BASENAMES.has(baseName)) {
    return true;
  }
  return METADATA_EXTENSIONS.has(path.extname(normalized));
};

const isLikelyGeneratedPath = (relativePath: string): boolean => {
  const normalized = normalizePathForMatch(relativePath);
  return [
    '/dist/',
    '/build/',
    '/coverage/',
    '/node_modules/',
    '/.dart_tool/',
    '/android/',
    '/ios/',
    '/windows/',
    '/linux/',
    '/macos/',
    '/web/',
    '/runner/',
  ].some((segment) => normalized.includes(segment));
};

const isLikelyText = (content: Buffer): boolean => {
  if (content.length === 0) return true;
  const sampleSize = Math.min(content.length, 4096);
  let nonText = 0;

  for (let i = 0; i < sampleSize; i++) {
    const byte = content[i];
    if (byte === 0) return false;
    const isControl = byte < 9 || (byte > 13 && byte < 32);
    if (isControl) nonText++;
  }

  return nonText / sampleSize < 0.1;
};

const shouldIncludeFile = (filePath: string, size: number): boolean => {
  const ext = path.extname(filePath).toLowerCase();
  if (READABLE_EXTENSIONS.has(ext)) return true;
  return size <= 100 * 1024;
};

const isZipFile = (file: SubmissionFileInfo): boolean => {
  const lowerName = (file.fileName || '').toLowerCase();
  const lowerMime = (file.mimeType || '').toLowerCase();
  return (
    lowerName.endsWith('.zip') ||
    lowerMime.includes('zip') ||
    lowerMime.includes('compressed')
  );
};

const normalizeCriterionKey = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim();

const extractAnyJsonObject = (raw: string): Record<string, unknown> => {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('LLM returned empty response');
  }

  const fencedMatch = trimmed.match(/```json\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1]?.trim() || trimmed;

  try {
    const parsed = JSON.parse(candidate) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Response JSON must be an object');
    }
    return parsed as Record<string, unknown>;
  } catch {
    const firstBrace = candidate.indexOf('{');
    const lastBrace = candidate.lastIndexOf('}');
    if (firstBrace < 0 || lastBrace <= firstBrace) {
      throw new Error('LLM response is not valid JSON');
    }
    const objectLike = candidate.slice(firstBrace, lastBrace + 1);
    const parsed = JSON.parse(objectLike) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Response JSON must be an object');
    }
    return parsed as Record<string, unknown>;
  }
};

const findBestCriterionMatch = (
  criterion: GradingCriterion,
  parsedScores: NonNullable<LlmGradeJson['criterionScores']>,
): (typeof parsedScores)[number] | undefined => {
  const rubricKey = normalizeCriterionKey(criterion.criterion);
  if (!rubricKey) return undefined;

  for (const item of parsedScores) {
    const itemKey = normalizeCriterionKey(item.criterion || '');
    if (!itemKey) continue;
    if (
      itemKey === rubricKey ||
      itemKey.includes(rubricKey) ||
      rubricKey.includes(itemKey)
    ) {
      return item;
    }
  }
  return undefined;
};

const distributeTotalScoreByRubric = (
  rubric: GradingCriterion[],
  totalScore: number,
  maxPossibleScore: number,
): LlmCriterionScore[] => {
  if (rubric.length === 0) return [];
  const safeMax = Math.max(1, maxPossibleScore);
  const clampedTotal = Number(clamp(totalScore, 0, safeMax).toFixed(2));
  const distributed: LlmCriterionScore[] = [];
  let assigned = 0;

  for (let i = 0; i < rubric.length; i++) {
    const criterion = rubric[i];
    const isLast = i === rubric.length - 1;
    const score = isLast
      ? Number(
        clamp(Number((clampedTotal - assigned).toFixed(2)), 0, criterion.maxScore).toFixed(2),
      )
      : Number(
        clamp(
          Number((clampedTotal * (criterion.maxScore / safeMax)).toFixed(2)),
          0,
          criterion.maxScore,
        ).toFixed(2),
      );
    assigned = Number((assigned + score).toFixed(2));
    distributed.push({
      criterion: criterion.criterion,
      maxScore: criterion.maxScore,
      score,
    });
  }
  return distributed;
};

const buildDefaultRubric = (maxScore: number): GradingCriterion[] => {
  const safeMaxScore = Math.max(1, maxScore);
  const ratios = [0.4, 0.3, 0.2, 0.1];
  const labels: GradingCriterion[] = [
    {
      criterion: 'Functionality',
      description: 'Completeness and correctness of required features',
      maxScore: 0,
    },
    {
      criterion: 'Code Quality',
      description: 'Readability, maintainability, and clean structure',
      maxScore: 0,
    },
    {
      criterion: 'Project Structure',
      description: 'Organization, modularity, and file structure',
      maxScore: 0,
    },
    {
      criterion: 'Documentation',
      description: 'Comments and documentation quality',
      maxScore: 0,
    },
  ];

  let assigned = 0;
  for (let i = 0; i < labels.length; i++) {
    if (i === labels.length - 1) {
      labels[i].maxScore = safeMaxScore - assigned;
    } else {
      const score = Math.max(1, Math.round(safeMaxScore * ratios[i]));
      labels[i].maxScore = score;
      assigned += score;
    }
  }
  return labels;
};

const normalizeRubric = (
  criteria: GradingCriterion[] | undefined,
  maxScore: number,
): GradingCriterion[] => {
  if (!criteria || criteria.length === 0) {
    return buildDefaultRubric(maxScore);
  }
  const sanitized = criteria
    .filter((item) => item && item.criterion && Number.isFinite(item.maxScore))
    .map((item) => ({
      criterion: item.criterion.trim(),
      description: item.description?.trim(),
      maxScore: Math.max(0, Math.round(item.maxScore)),
    }))
    .filter((item) => item.criterion.length > 0 && item.maxScore > 0);

  if (sanitized.length === 0) {
    return buildDefaultRubric(maxScore);
  }
  return sanitized;
};

const detectProjectType = (paths: string[]): string => {
  const hasSuffix = (suffix: string): boolean =>
    paths.some((filePath) => filePath.endsWith(normalizePattern(suffix)));
  const hasFragment = (fragment: string): boolean =>
    paths.some((filePath) => filePath.includes(normalizePattern(fragment)));
  const countByExtension = (extensions: Set<string>): number =>
    paths.filter((filePath) => extensions.has(path.extname(filePath))).length;

  if (
    hasSuffix('/pubspec.yaml') ||
    paths.some((filePath) => filePath.includes('/lib/') && filePath.endsWith('.dart'))
  ) {
    return 'flutter';
  }
  if (hasSuffix('/angular.json')) return 'angular';
  if (hasSuffix('/next.config.js') || hasSuffix('/next.config.mjs')) return 'nextjs';
  if (hasSuffix('/nest-cli.json') || hasFragment('/src/modules/')) return 'nestjs';
  if (
    hasSuffix('/requirements.txt') ||
    hasSuffix('/pyproject.toml') ||
    hasSuffix('/poetry.lock') ||
    countByExtension(PYTHON_EXTENSIONS) >= 3
  ) {
    return 'python';
  }
  if (
    hasSuffix('/pom.xml') ||
    hasSuffix('/build.gradle') ||
    hasFragment('/src/main/java/') ||
    countByExtension(JVM_EXTENSIONS) >= 3
  ) {
    return 'jvm';
  }
  if (
    hasFragment('.csproj') ||
    hasSuffix('/program.cs') ||
    countByExtension(DOTNET_EXTENSIONS) >= 3
  ) {
    return 'dotnet';
  }
  if (hasSuffix('/go.mod') || countByExtension(GO_EXTENSIONS) >= 3) return 'go';
  if (
    hasSuffix('/cargo.toml') ||
    hasFragment('/src/main.rs') ||
    countByExtension(RUST_EXTENSIONS) >= 3
  ) {
    return 'rust';
  }
  if (
    hasSuffix('/composer.json') ||
    hasFragment('/artisan') ||
    countByExtension(PHP_EXTENSIONS) >= 3
  ) {
    return 'php';
  }
  if (countByExtension(CPP_C_EXTENSIONS) >= 4) return 'cpp-c';
  if (hasSuffix('/package.json') && countByExtension(JAVASCRIPT_TYPESCRIPT_EXTENSIONS) >= 4) {
    return 'node-web';
  }
  return 'generic';
};

const contextForProjectType = (projectType: string): Omit<InferredProjectContext, 'source'> => {
  switch (projectType) {
    case 'flutter':
      return {
        projectType: 'flutter',
        keyDirectories: ['lib', 'test', 'integration_test', 'bin'],
        prioritizePatterns: ['/lib/', '/test/', '/integration_test/', '/bin/'],
        deprioritizePatterns: [
          '/android/',
          '/ios/',
          '/windows/',
          '/linux/',
          '/macos/',
          '/web/',
          '/runner/',
          '/build/',
          '/.dart_tool/',
        ],
        implementationExtensions: ['.dart'],
      };
    case 'angular':
      return {
        projectType: 'angular',
        keyDirectories: ['src/app', 'src'],
        prioritizePatterns: ['/src/app/', '/src/'],
        deprioritizePatterns: ['/node_modules/', '/dist/', '/coverage/', '/.angular/'],
        implementationExtensions: Array.from(JAVASCRIPT_TYPESCRIPT_EXTENSIONS),
      };
    case 'nextjs':
      return {
        projectType: 'nextjs',
        keyDirectories: ['app', 'pages', 'src'],
        prioritizePatterns: ['/app/', '/pages/', '/src/', '/components/'],
        deprioritizePatterns: ['/node_modules/', '/.next/', '/dist/', '/coverage/'],
        implementationExtensions: Array.from(JAVASCRIPT_TYPESCRIPT_EXTENSIONS),
      };
    case 'nestjs':
      return {
        projectType: 'nestjs',
        keyDirectories: ['src/modules', 'src/common', 'src/auth', 'src'],
        prioritizePatterns: ['/src/modules/', '/src/common/', '/src/auth/', '/src/'],
        deprioritizePatterns: ['/node_modules/', '/dist/', '/coverage/'],
        implementationExtensions: Array.from(JAVASCRIPT_TYPESCRIPT_EXTENSIONS),
      };
    case 'node-web':
      return {
        projectType: 'node-web',
        keyDirectories: ['src', 'app', 'server'],
        prioritizePatterns: ['/src/', '/app/', '/server/', '/routes/', '/controllers/'],
        deprioritizePatterns: ['/node_modules/', '/dist/', '/build/', '/coverage/'],
        implementationExtensions: Array.from(JAVASCRIPT_TYPESCRIPT_EXTENSIONS),
      };
    case 'python':
      return {
        projectType: 'python',
        keyDirectories: ['src', 'app', 'project'],
        prioritizePatterns: ['/src/', '/app/', '/project/', '/tests/'],
        deprioritizePatterns: [
          '/venv/',
          '/.venv/',
          '/site-packages/',
          '/dist/',
          '/build/',
          '/__pycache__/',
        ],
        implementationExtensions: Array.from(PYTHON_EXTENSIONS),
      };
    case 'jvm':
      return {
        projectType: 'jvm',
        keyDirectories: ['src/main/java', 'src/main/kotlin', 'src/test/java'],
        prioritizePatterns: ['/src/main/java/', '/src/main/kotlin/', '/src/test/java/'],
        deprioritizePatterns: ['/build/', '/target/', '/.gradle/', '/out/'],
        implementationExtensions: Array.from(JVM_EXTENSIONS),
      };
    case 'dotnet':
      return {
        projectType: 'dotnet',
        keyDirectories: ['src', 'app'],
        prioritizePatterns: ['/src/', '/app/', '/controllers/', '/services/'],
        deprioritizePatterns: ['/bin/', '/obj/', '/packages/', '/testresults/'],
        implementationExtensions: Array.from(DOTNET_EXTENSIONS),
      };
    case 'go':
      return {
        projectType: 'go',
        keyDirectories: ['cmd', 'internal', 'pkg'],
        prioritizePatterns: ['/cmd/', '/internal/', '/pkg/'],
        deprioritizePatterns: ['/vendor/', '/bin/', '/dist/', '/build/'],
        implementationExtensions: Array.from(GO_EXTENSIONS),
      };
    case 'rust':
      return {
        projectType: 'rust',
        keyDirectories: ['src', 'tests'],
        prioritizePatterns: ['/src/', '/tests/'],
        deprioritizePatterns: ['/target/', '/.cargo/'],
        implementationExtensions: Array.from(RUST_EXTENSIONS),
      };
    case 'php':
      return {
        projectType: 'php',
        keyDirectories: ['app', 'routes', 'src'],
        prioritizePatterns: ['/app/', '/routes/', '/src/'],
        deprioritizePatterns: ['/vendor/', '/storage/', '/bootstrap/cache/'],
        implementationExtensions: Array.from(PHP_EXTENSIONS),
      };
    case 'cpp-c':
      return {
        projectType: 'cpp-c',
        keyDirectories: ['src', 'include'],
        prioritizePatterns: ['/src/', '/include/'],
        deprioritizePatterns: ['/build/', '/cmake-build-', '/dist/'],
        implementationExtensions: Array.from(CPP_C_EXTENSIONS),
      };
    default:
      return {
        projectType: 'generic',
        keyDirectories: ['src', 'app', 'lib'],
        prioritizePatterns: ['/src/', '/app/', '/lib/'],
        deprioritizePatterns: ['/dist/', '/build/', '/vendor/', '/coverage/'],
        implementationExtensions: Array.from(CODE_EXTENSIONS),
      };
  }
};

const buildHeuristicProjectContext = (paths: string[]): InferredProjectContext => {
  const projectType = detectProjectType(paths);
  const base = contextForProjectType(projectType);
  return {
    ...base,
    source: 'heuristic',
  };
};

const normalizeProjectContext = (
  context: Partial<InferredProjectContext>,
  fallback: InferredProjectContext,
): InferredProjectContext => {
  const projectType = (context.projectType || fallback.projectType || 'generic').toLowerCase();
  const base = contextForProjectType(projectType);

  const keyDirectories = uniqueStrings([
    ...base.keyDirectories,
    ...toStringArray(context.keyDirectories),
  ]).map(normalizePattern);
  const prioritizePatterns = uniqueStrings([
    ...base.prioritizePatterns,
    ...toStringArray(context.prioritizePatterns),
  ]).map(normalizePattern);
  const deprioritizePatterns = uniqueStrings([
    ...base.deprioritizePatterns,
    ...toStringArray(context.deprioritizePatterns),
  ]).map(normalizePattern);
  const implementationExtensions = uniqueStrings([
    ...base.implementationExtensions,
    ...toStringArray(context.implementationExtensions).map((item) =>
      item.startsWith('.') ? item.toLowerCase() : `.${item.toLowerCase()}`,
    ),
  ]);

  return {
    projectType: base.projectType,
    keyDirectories,
    prioritizePatterns,
    deprioritizePatterns,
    implementationExtensions,
    source: context.source === 'llm' ? 'llm' : 'heuristic',
  };
};

const isImplementationPath = (
  relativePath: string,
  projectContext: InferredProjectContext,
): boolean => {
  const normalizedPath = normalizePathForMatch(relativePath);
  const ext = path.extname(normalizedPath);
  if (isMetadataPath(relativePath)) {
    return false;
  }
  if (projectContext.implementationExtensions.length > 0) {
    if (!projectContext.implementationExtensions.includes(ext)) {
      return false;
    }
  } else if (!CODE_EXTENSIONS.has(ext)) {
    return false;
  }
  if (matchesAnyPattern(relativePath, projectContext.deprioritizePatterns)) {
    return false;
  }
  if (matchesAnyPattern(relativePath, projectContext.prioritizePatterns)) {
    return true;
  }
  if (projectContext.keyDirectories.some((dir) => normalizedPath.includes(`/${dir}/`))) {
    return true;
  }
  return !isLikelyGeneratedPath(relativePath);
};

export class AssignmentSubmissionGrader {
  async grade(payload: GradeRequestPayload): Promise<BatchGradeResult> {
    if (!payload.userToken) {
      throw new Error('Missing userToken');
    }

    const client = createInternalClient(payload.userToken);
    const similarityThreshold = clamp(toNumber(payload.similarityThreshold, 0.85), 0, 1);
    const defaultMaxScore = Math.max(1, Math.round(payload.defaultMaxScore || 100));
    const rubric = normalizeRubric(payload.gradingCriteria, defaultMaxScore);
    const maxPossibleScore = rubric.reduce((sum, item) => sum + item.maxScore, 0);

    const submissionsResponse = await this.executeWithRetry({
      label: `fetch submissions for assignment ${payload.assignmentId}`,
      timeoutMs: DOWNLOAD_REQUEST_TIMEOUT_MS,
      operation: () =>
        client.get(
          `/courses/${payload.courseId}/lessons/${payload.lessonId}/assignments/${payload.assignmentId}/submissions`,
          {
            timeout: DOWNLOAD_REQUEST_TIMEOUT_MS,
          },
        ),
    });
    const allSubmissions = unwrapApiData<CourseAssignmentSubmission[]>(submissionsResponse.data);

    if (!Array.isArray(allSubmissions) || allSubmissions.length === 0) {
      return {
        assignmentId: payload.assignmentId,
        gradedCount: 0,
        flaggedCount: 0,
        results: [],
      };
    }

    const latestByAuthor = new Map<string, CourseAssignmentSubmission>();
    for (const submission of allSubmissions) {
      const current = latestByAuthor.get(submission.authorId);
      if (!current || submission.attemptNumber > current.attemptNumber) {
        latestByAuthor.set(submission.authorId, submission);
      }
    }

    const latestSubmissions = Array.from(latestByAuthor.values());
    const targetSubmissions = payload.submissionIds?.length
      ? allSubmissions.filter((submission) => payload.submissionIds!.includes(submission.id))
      : latestSubmissions;

    if (targetSubmissions.length === 0) {
      return {
        assignmentId: payload.assignmentId,
        gradedCount: 0,
        flaggedCount: 0,
        results: [],
      };
    }

    const poolById = new Map<string, CourseAssignmentSubmission>();
    for (const submission of latestSubmissions) {
      poolById.set(submission.id, submission);
    }
    for (const submission of targetSubmissions) {
      if (!poolById.has(submission.id)) {
        poolById.set(submission.id, submission);
      }
    }

    const poolSubmissions = Array.from(poolById.values());
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'coderank-assignment-grading-'));

    try {
      const preparedMap = new Map<string, SubmissionPreparedData>();
      const preparationErrors = new Map<string, string>();
      for (const submission of poolSubmissions) {
        try {
          const prepared = await this.prepareSubmissionData({
            client,
            payload,
            submission,
            tempRoot,
          });
          preparedMap.set(submission.id, prepared);
        } catch (error: unknown) {
          const message = errorMessage(error);
          preparationErrors.set(submission.id, message);
          console.log(
            `[AssignmentSubmissionGrader] prepare failed for submission ${submission.id} (student ${submission.authorId}): ${message}`,
          );
        }
      }
      this.pruneCommonSimilarityTokens(preparedMap);

      const llmConfig: ILLMConfig | undefined =
        payload.apiKey || payload.baseHost
          ? {
            apiKey: payload.apiKey,
            baseHost: payload.baseHost,
          }
          : undefined;

      const providerSelection = LLMFactory.createProviderWithFallback(
        payload.provider,
        payload.modelName,
        llmConfig,
      );
      const defaultProviderName = providerSelection.actualType;
      const modelName = payload.modelName;
      const maxConcurrencyForProvider =
        defaultProviderName === 'ollama' ? 1 : MAX_CONCURRENT_SUBMISSION_GRADING;

      const gradingConcurrency = Math.min(
        maxConcurrencyForProvider,
        Math.max(1, targetSubmissions.length),
      );
      console.log(
        `[AssignmentSubmissionGrader] grading ${targetSubmissions.length} submissions with concurrency=${gradingConcurrency}`,
      );

      const results = await this.mapWithConcurrencyLimit(
        targetSubmissions,
        gradingConcurrency,
        async (submission, submissionIndex) => {
          const prepared = preparedMap.get(submission.id);
          if (!prepared) {
            const preparationMessage =
              preparationErrors.get(submission.id) ||
              'No readable files were extracted from this submission';
            const failedResult = {
              rubricUsed: rubric,
              criterionScores: [],
              score: 0,
              maxScore: maxPossibleScore,
              percentageScore: 0,
              feedback: `Submission preparation failed: ${preparationMessage}`,
              strengths: [],
              improvements: [],
              confidence: 0,
              evaluatedFileCount: 0,
              generatedAt: new Date().toISOString(),
              graderProvider: defaultProviderName,
              graderModel: modelName,
              error: preparationMessage,
            };

            console.log(
              `[AssignmentSubmissionGrader] skip grading submission ${submission.id} (student ${submission.authorId}) because prepare failed`,
            );

            return {
              submissionId: submission.id,
              status: submission.status || 'submitted',
              feedback: failedResult.feedback,
              isSimilarityFlagged: false,
              maxSimilarityScore: undefined,
              similarityMatches: [],
              aiGradingResult: failedResult,
            } satisfies BatchGradeResult['results'][number];
          }

          console.log(
            `[AssignmentSubmissionGrader] progress ${submissionIndex + 1}/${targetSubmissions.length} start grading submission ${submission.id} (student ${submission.authorId}, attempt ${submission.attemptNumber})`,
          );

          const submissionProviderSelection = LLMFactory.createProviderWithFallback(
            payload.provider,
            payload.modelName,
            llmConfig,
          );
          const provider = submissionProviderSelection.provider;
          const providerName = submissionProviderSelection.actualType;

          const projectContext = await this.inferProjectContext({
            provider,
            payload,
            prepared,
          });
          const selectedSnippets = await this.selectSnippetsForGrading({
            provider,
            payload,
            rubric,
            prepared,
            projectContext,
          });

          console.log(
            `[AssignmentSubmissionGrader] projectType=${projectContext.projectType} source=${projectContext.source} selected ${selectedSnippets.length}/${prepared.snippets.length} files for grading submission ${submission.id} (student ${submission.authorId}):`,
            selectedSnippets.map((item) => item.relativePath),
          );

          const similarityMatches = this.computeSimilarityMatches(
            submission.id,
            preparedMap,
            similarityThreshold,
          );
          const maxSimilarityScore = similarityMatches[0]?.similarity;
          const isSimilarityFlagged = similarityMatches.length > 0;

          try {
            const grading = await this.gradeSingleSubmission({
              provider,
              providerName,
              modelName,
              payload,
              rubric,
              maxPossibleScore,
              prepared,
              selectedSnippets,
            });

            console.log(
              `[AssignmentSubmissionGrader] completed grading submission ${submission.id} (student ${submission.authorId}) score=${grading.score}/${grading.maxScore}`,
            );

            return {
              submissionId: submission.id,
              status: 'graded',
              score: grading.score,
              feedback: grading.feedback,
              isSimilarityFlagged,
              maxSimilarityScore,
              similarityMatches,
              aiGradingResult: grading,
            } satisfies BatchGradeResult['results'][number];
          } catch (error: unknown) {
            const message = errorMessage(error);
            const failedResult = {
              rubricUsed: rubric,
              criterionScores: [],
              score: 0,
              maxScore: maxPossibleScore,
              percentageScore: 0,
              feedback: `AI grading failed: ${message}`,
              strengths: [],
              improvements: [],
              confidence: 0,
              evaluatedFileCount: selectedSnippets.length,
              generatedAt: new Date().toISOString(),
              graderProvider: providerName,
              graderModel: modelName,
              error: message,
            };

            console.log(
              `[AssignmentSubmissionGrader] failed grading submission ${submission.id} (student ${submission.authorId}): ${message}`,
            );

            return {
              submissionId: submission.id,
              status: submission.status || 'submitted',
              feedback: failedResult.feedback,
              isSimilarityFlagged,
              maxSimilarityScore,
              similarityMatches,
              aiGradingResult: failedResult,
            } satisfies BatchGradeResult['results'][number];
          }
        },
      );

      const flaggedCount = results.filter((result) => result.isSimilarityFlagged).length;

      return {
        assignmentId: payload.assignmentId,
        gradedCount: results.length,
        flaggedCount,
        results,
      };
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  }

  private async executeWithRetry<T>(params: {
    label: string;
    timeoutMs: number;
    operation: () => Promise<T>;
    maxAttempts?: number;
  }): Promise<T> {
    const maxAttempts = Math.max(1, params.maxAttempts || MAX_RETRY_ATTEMPTS);
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await withTimeout(params.operation, params.timeoutMs, params.label);
      } catch (error: unknown) {
        lastError = error;
        const canRetry = attempt < maxAttempts && isRetryableError(error);
        if (!canRetry) {
          throw error;
        }

        const nextAttempt = attempt + 1;
        const delayMs = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
        console.log(
          `[AssignmentSubmissionGrader] retry ${nextAttempt}/${maxAttempts} for ${params.label} after error: ${errorMessage(error)} (backoff=${delayMs}ms)`,
        );
        await wait(delayMs);
      }
    }

    throw new Error(`${params.label} failed after ${maxAttempts} attempts: ${errorMessage(lastError)}`);
  }

  private async sendProviderMessageWithRetry(
    provider: LlmProvider,
    prompt: string,
    label: string,
    options?: {
      timeoutMs?: number;
      maxAttempts?: number;
    },
  ): Promise<Awaited<ReturnType<LlmProvider['sendMessage']>>> {
    return this.executeWithRetry({
      label: `llm request (${label})`,
      timeoutMs: options?.timeoutMs || LLM_REQUEST_TIMEOUT_MS,
      operation: () => provider.sendMessage(prompt),
      maxAttempts: options?.maxAttempts,
    });
  }

  private getLlmRequestOptions(providerName: LLMProviderType): {
    timeoutMs: number;
    maxAttempts: number;
  } {
    if (providerName === 'ollama') {
      return {
        timeoutMs: OLLAMA_LLM_REQUEST_TIMEOUT_MS,
        maxAttempts: OLLAMA_MAX_RETRY_ATTEMPTS,
      };
    }

    return {
      timeoutMs: LLM_REQUEST_TIMEOUT_MS,
      maxAttempts: MAX_RETRY_ATTEMPTS,
    };
  }

  private async mapWithConcurrencyLimit<T, R>(
    items: T[],
    concurrency: number,
    worker: (item: T, index: number) => Promise<R>,
  ): Promise<R[]> {
    if (items.length === 0) {
      return [];
    }

    const results = new Array<R>(items.length);
    const workerCount = Math.max(1, Math.min(concurrency, items.length));
    let nextIndex = 0;

    const consume = async (): Promise<void> => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await worker(items[currentIndex], currentIndex);
      }
    };

    await Promise.all(Array.from({ length: workerCount }, () => consume()));
    return results;
  }

  private validateGradingJsonPayload(payload: Record<string, unknown>): LlmGradeJson {
    const validated: LlmGradeJson = {};

    if (payload.criterionScores !== undefined) {
      if (!Array.isArray(payload.criterionScores)) {
        throw new Error('criterionScores must be an array');
      }

      validated.criterionScores = payload.criterionScores.map((item, index) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          throw new Error(`criterionScores[${index}] must be an object`);
        }
        const criterion = (item as any).criterion;
        const score = (item as any).score;
        const feedback = (item as any).feedback;

        if (typeof criterion !== 'string' || !criterion.trim()) {
          throw new Error(`criterionScores[${index}].criterion must be a non-empty string`);
        }
        if (typeof score !== 'number' || !Number.isFinite(score)) {
          throw new Error(`criterionScores[${index}].score must be a finite number`);
        }
        if (feedback !== undefined && typeof feedback !== 'string') {
          throw new Error(`criterionScores[${index}].feedback must be a string when provided`);
        }

        return {
          criterion: criterion.trim(),
          score,
          feedback: typeof feedback === 'string' ? feedback.trim() : undefined,
        };
      });
    }

    if (payload.totalScore !== undefined) {
      if (typeof payload.totalScore !== 'number' || !Number.isFinite(payload.totalScore)) {
        throw new Error('totalScore must be a finite number');
      }
      if (payload.totalScore < 0) {
        throw new Error('totalScore must be >= 0');
      }
      validated.totalScore = payload.totalScore;
    }

    if (payload.feedback !== undefined) {
      if (typeof payload.feedback !== 'string') {
        throw new Error('feedback must be a string');
      }
      validated.feedback = payload.feedback;
    }

    if (payload.strengths !== undefined) {
      if (!Array.isArray(payload.strengths) || payload.strengths.some((item) => typeof item !== 'string')) {
        throw new Error('strengths must be an array of strings');
      }
      validated.strengths = payload.strengths;
    }

    if (payload.improvements !== undefined) {
      if (
        !Array.isArray(payload.improvements) ||
        payload.improvements.some((item) => typeof item !== 'string')
      ) {
        throw new Error('improvements must be an array of strings');
      }
      validated.improvements = payload.improvements;
    }

    if (payload.confidence !== undefined) {
      const rawConfidence =
        typeof payload.confidence === 'number'
          ? payload.confidence
          : typeof payload.confidence === 'string'
            ? Number(payload.confidence)
            : NaN;
      if (!Number.isFinite(rawConfidence)) {
        throw new Error('confidence must be a finite number');
      }
      validated.confidence = normalizeConfidenceValue(rawConfidence);
    }

    if (Object.keys(validated).length === 0) {
      throw new Error('Grading JSON contains no recognized fields');
    }

    return validated;
  }

  private validateReadDecisionPayload(payload: Record<string, unknown>): LlmReadDecisionJson {
    const validated: LlmReadDecisionJson = {};

    if (payload.needsMoreFiles === undefined) {
      throw new Error('needsMoreFiles is required');
    }
    if (typeof payload.needsMoreFiles !== 'boolean') {
      throw new Error('needsMoreFiles must be a boolean');
    }
    validated.needsMoreFiles = payload.needsMoreFiles;

    if (payload.reason !== undefined) {
      if (typeof payload.reason !== 'string') {
        throw new Error('reason must be a string');
      }
      validated.reason = payload.reason;
    }

    if (payload.confidence !== undefined) {
      const rawConfidence =
        typeof payload.confidence === 'number'
          ? payload.confidence
          : typeof payload.confidence === 'string'
            ? Number(payload.confidence)
            : NaN;
      if (!Number.isFinite(rawConfidence)) {
        throw new Error('confidence must be a finite number');
      }
      validated.confidence = normalizeConfidenceValue(rawConfidence);
    }

    if (payload.missingEvidence !== undefined) {
      if (
        !Array.isArray(payload.missingEvidence) ||
        payload.missingEvidence.some((item) => typeof item !== 'string')
      ) {
        throw new Error('missingEvidence must be an array of strings');
      }
      validated.missingEvidence = payload.missingEvidence;
    }

    return validated;
  }

  private async validateZipEntriesSafety(zipFilePath: string): Promise<void> {
    const listing = await execFileAsync('unzip', ['-Z1', zipFilePath], {
      maxBuffer: ZIP_LIST_MAX_BUFFER,
      timeout: DOWNLOAD_REQUEST_TIMEOUT_MS,
    });

    const entries = listing.stdout
      .split(/\r?\n/g)
      .map((entry) => entry.trim())
      .filter(Boolean);

    for (const entry of entries) {
      const normalized = path.posix.normalize(entry.replace(/\\/g, '/'));
      if (!normalized || normalized === '.') {
        continue;
      }

      const hasParentTraversal =
        normalized === '..' || normalized.startsWith('../') || normalized.includes('/../');
      const isAbsolute = path.posix.isAbsolute(normalized) || /^[a-zA-Z]:/.test(normalized);
      if (hasParentTraversal || isAbsolute || normalized.includes('\u0000')) {
        throw new Error(`Zip contains unsafe entry path: ${entry}`);
      }
    }
  }

  private async inferProjectContext(params: {
    provider: LlmProvider;
    payload: GradeRequestPayload;
    prepared: SubmissionPreparedData;
  }): Promise<InferredProjectContext> {
    const { provider, payload, prepared } = params;
    const paths = prepared.snippets
      .filter((snippet) => snippet.relativePath !== 'submission-content.txt')
      .map((snippet) => normalizePathForMatch(snippet.relativePath));
    const heuristic = buildHeuristicProjectContext(paths);

    if (paths.length === 0) {
      return heuristic;
    }

    const samplePaths = paths.slice(0, MAX_PATHS_FOR_PROJECT_INFERENCE);
    provider.init(PROJECT_CONTEXT_SYSTEM_PROMPT, [], []);

    try {
      const prompt = [
        `Assignment title: ${payload.assignmentTitle || '(untitled assignment)'}`,
        `Assignment description: ${payload.assignmentDescription || '(no description provided)'}`,
        `Heuristic context: ${JSON.stringify(heuristic)}`,
        'Infer project context and return STRICT JSON schema:',
        '{"projectType":"string","keyDirectories":["string"],"prioritizePatterns":["string"],"deprioritizePatterns":["string"],"implementationExtensions":[".ext"]}',
        `File paths: ${JSON.stringify(samplePaths)}`,
      ].join('\n\n');

      const response = await this.sendProviderMessageWithRetry(
        provider,
        prompt,
        `project context inference for submission ${prepared.submission.id}`,
      );
      if (!response.text || response.toolCalls?.length) {
        return heuristic;
      }

      const parsed = extractAnyJsonObject(response.text) as LlmProjectContextJson;
      return normalizeProjectContext(
        {
          projectType:
            typeof parsed.projectType === 'string' && parsed.projectType.trim()
              ? parsed.projectType.trim().toLowerCase()
              : heuristic.projectType,
          keyDirectories: toStringArray(parsed.keyDirectories),
          prioritizePatterns: toStringArray(parsed.prioritizePatterns),
          deprioritizePatterns: toStringArray(parsed.deprioritizePatterns),
          implementationExtensions: toStringArray(parsed.implementationExtensions),
          source: 'llm',
        },
        heuristic,
      );
    } catch {
      return heuristic;
    }
  }

  private async selectSnippetsForGrading(params: {
    provider: LlmProvider;
    payload: GradeRequestPayload;
    rubric: GradingCriterion[];
    prepared: SubmissionPreparedData;
    projectContext: InferredProjectContext;
  }): Promise<SubmissionFileSnippet[]> {
    const { prepared, projectContext } = params;

    const candidateSnippets = prepared.snippets.filter(
      (snippet) => snippet.relativePath !== 'submission-content.txt',
    );
    if (candidateSnippets.length === 0) {
      return prepared.snippets.slice(0, 1);
    }

    const ranked = this.rankSnippets(candidateSnippets, projectContext);
    const rankedSnippets = ranked.map((item) => item.snippet);
    const traversalSelection = this.selectByMainFirstTraversal(
      rankedSnippets,
      projectContext,
    );

    return this.enforceSelectionConstraints(
      traversalSelection,
      rankedSnippets,
      projectContext,
    );
  }

  private selectByMainFirstTraversal(
    rankedSnippets: SubmissionFileSnippet[],
    projectContext: InferredProjectContext,
  ): SubmissionFileSnippet[] {
    const snippetByPath = new Map<string, SubmissionFileSnippet>();
    const allPaths = new Set<string>();
    for (const snippet of rankedSnippets) {
      const normalizedPath = normalizePathForMatch(snippet.relativePath);
      snippetByPath.set(normalizedPath, snippet);
      allPaths.add(normalizedPath);
    }

    const entrySnippets = this.findEntrySnippets(rankedSnippets, projectContext);
    const queue = entrySnippets.map((snippet) =>
      normalizePathForMatch(snippet.relativePath),
    );
    const queued = new Set(queue);
    const visited = new Set<string>();
    const selected: SubmissionFileSnippet[] = [];

    while (queue.length > 0 && selected.length < MAX_FILES_FOR_TRAVERSAL) {
      const currentPath = queue.shift()!;
      queued.delete(currentPath);
      if (visited.has(currentPath)) {
        continue;
      }
      visited.add(currentPath);

      const currentSnippet = snippetByPath.get(currentPath);
      if (!currentSnippet) {
        continue;
      }
      if (!selected.includes(currentSnippet)) {
        selected.push(currentSnippet);
      }

      const dependencies = this.extractDependencySpecifiers(
        currentSnippet.content,
        currentSnippet.relativePath,
      );
      for (const dependency of dependencies) {
        const resolvedPath = this.resolveDependencyPath({
          dependency,
          importerPath: currentPath,
          allPaths,
          projectContext,
        });
        if (!resolvedPath) {
          continue;
        }
        if (!visited.has(resolvedPath) && !queued.has(resolvedPath)) {
          queue.push(resolvedPath);
          queued.add(resolvedPath);
        }
      }
    }

    return selected;
  }

  private findEntrySnippets(
    rankedSnippets: SubmissionFileSnippet[],
    projectContext: InferredProjectContext,
  ): SubmissionFileSnippet[] {
    const entrySuffixes = this.getEntryPointSuffixes(projectContext.projectType);
    const matchedEntries: SubmissionFileSnippet[] = [];

    for (const suffix of entrySuffixes) {
      const normalizedSuffix = normalizePattern(suffix);
      const exact = rankedSnippets.find((snippet) =>
        normalizePathForMatch(snippet.relativePath).endsWith(normalizedSuffix),
      );
      if (exact && !matchedEntries.includes(exact)) {
        matchedEntries.push(exact);
      }
    }

    if (matchedEntries.length > 0) {
      return matchedEntries;
    }

    const implementationFallback = rankedSnippets.find((snippet) =>
      isImplementationPath(snippet.relativePath, projectContext),
    );
    if (implementationFallback) {
      return [implementationFallback];
    }

    return rankedSnippets.slice(0, 1);
  }

  private getEntryPointSuffixes(projectType: string): string[] {
    const type = (projectType || '').toLowerCase();
    if (type === 'flutter') {
      return ['/lib/main.dart', '/bin/main.dart', '/main.dart'];
    }
    if (type === 'angular') {
      return ['/src/main.ts', '/src/main.js', '/src/app/app.module.ts', '/src/app/app.component.ts'];
    }
    if (type === 'nextjs') {
      return ['/app/page.tsx', '/app/page.jsx', '/pages/index.tsx', '/pages/index.jsx'];
    }
    if (type === 'nestjs') {
      return ['/src/main.ts', '/src/main.js', '/src/app.module.ts'];
    }
    if (type === 'node-web') {
      return [
        '/src/main.ts',
        '/src/index.ts',
        '/src/app.ts',
        '/main.ts',
        '/index.ts',
        '/src/main.js',
        '/src/index.js',
        '/main.js',
        '/index.js',
      ];
    }
    if (type === 'python') {
      return ['/main.py', '/app.py', '/manage.py', '/__main__.py'];
    }
    if (type === 'jvm') {
      return ['/src/main/java/main.java', '/src/main/kotlin/main.kt', '/main.java', '/main.kt'];
    }
    if (type === 'dotnet') {
      return ['/program.cs'];
    }
    if (type === 'go') {
      return ['/main.go', '/cmd/main.go'];
    }
    if (type === 'rust') {
      return ['/src/main.rs', '/main.rs'];
    }
    if (type === 'php') {
      return ['/public/index.php', '/index.php'];
    }
    if (type === 'cpp-c') {
      return ['/src/main.cpp', '/main.cpp', '/src/main.c', '/main.c'];
    }

    return [
      '/src/main.ts',
      '/src/index.ts',
      '/src/main.js',
      '/src/index.js',
      '/main.py',
      '/main.java',
      '/main.cpp',
      '/main.c',
      '/main.dart',
      '/main.rs',
      '/main.go',
      '/program.cs',
      '/index.php',
    ];
  }

  private extractDependencySpecifiers(content: string, relativePath: string): string[] {
    const ext = path.extname(normalizePathForMatch(relativePath));
    const dependencies: string[] = [];
    const pushMatches = (regex: RegExp, groupIndex = 1) => {
      let match: RegExpExecArray | null;
      while ((match = regex.exec(content)) !== null) {
        const value = (match[groupIndex] || '').trim();
        if (value) {
          dependencies.push(value);
        }
      }
    };

    if (JAVASCRIPT_TYPESCRIPT_EXTENSIONS.has(ext)) {
      pushMatches(/import\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g);
      pushMatches(/export\s+[^'"]*?\s+from\s+['"]([^'"]+)['"]/g);
      pushMatches(/require\(\s*['"]([^'"]+)['"]\s*\)/g);
      pushMatches(/import\(\s*['"]([^'"]+)['"]\s*\)/g);
    } else if (ext === '.dart') {
      pushMatches(/(?:import|export|part)\s+['"]([^'"]+)['"]/g);
    } else if (ext === '.py') {
      pushMatches(/from\s+([a-zA-Z0-9_\.]+)\s+import\s+/g);
      pushMatches(/import\s+([a-zA-Z0-9_\.]+)(?:\s+as\s+[a-zA-Z0-9_]+)?/g);
    } else if (CPP_C_EXTENSIONS.has(ext)) {
      pushMatches(/#include\s+"([^"]+)"/g);
    } else if (ext === '.php') {
      pushMatches(/(?:require|require_once|include|include_once)\s*\(?\s*['"]([^'"]+)['"]/g);
    }

    return uniqueStrings(dependencies);
  }

  private resolveDependencyPath(params: {
    dependency: string;
    importerPath: string;
    allPaths: Set<string>;
    projectContext: InferredProjectContext;
  }): string | null {
    const { dependency, importerPath, allPaths, projectContext } = params;
    const raw = dependency.split('?')[0].split('#')[0].trim();
    if (!raw) return null;

    const importerDir = path.posix.dirname(importerPath);
    const candidateBases: string[] = [];

    if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('dart:')) {
      return null;
    }

    if (raw.startsWith('package:') && projectContext.projectType === 'flutter') {
      const afterPackage = raw.replace(/^package:[^/]+\/?/, '');
      if (afterPackage) {
        const projectRoot = this.getProjectRootFromPath(importerPath, projectContext);
        candidateBases.push(path.posix.normalize(path.posix.join(projectRoot, 'lib', afterPackage)));
      }
    } else if (raw.startsWith('./') || raw.startsWith('../')) {
      candidateBases.push(path.posix.normalize(path.posix.join(importerDir, raw)));
    } else if (raw.startsWith('/')) {
      const projectRoot = this.getProjectRootFromPath(importerPath, projectContext);
      candidateBases.push(path.posix.normalize(path.posix.join(projectRoot, raw)));
    } else {
      // Root-relative aliases and dotted modules.
      const projectRoot = this.getProjectRootFromPath(importerPath, projectContext);
      candidateBases.push(path.posix.normalize(path.posix.join(projectRoot, raw)));
      if (raw.includes('.')) {
        candidateBases.push(path.posix.normalize(path.posix.join(projectRoot, raw.replace(/\./g, '/'))));
      }
    }

    const resolvableExtensions = uniqueStrings([
      ...projectContext.implementationExtensions,
      ...Array.from(CODE_EXTENSIONS),
      '.json',
    ]);

    for (const base of candidateBases) {
      const candidates: string[] = [];
      const baseExt = path.extname(base);
      if (baseExt) {
        candidates.push(base);
      } else {
        candidates.push(base);
        for (const ext of resolvableExtensions) {
          candidates.push(`${base}${ext}`);
        }
        for (const ext of resolvableExtensions) {
          candidates.push(path.posix.join(base, `index${ext}`));
        }
      }

      for (const candidate of candidates) {
        const normalized = normalizePathForMatch(candidate);
        if (allPaths.has(normalized)) {
          return normalized;
        }
        const suffix = normalized.replace(/^\/+/, '');
        const fuzzyMatch = Array.from(allPaths).find(
          (filePath) =>
            filePath.endsWith(`/${suffix}`) ||
            filePath.endsWith(suffix),
        );
        if (fuzzyMatch) {
          return fuzzyMatch;
        }
      }
    }

    return null;
  }

  private getProjectRootFromPath(
    normalizedFilePath: string,
    projectContext: InferredProjectContext,
  ): string {
    const filePath = normalizePathForMatch(normalizedFilePath);
    for (const keyDir of projectContext.keyDirectories) {
      const marker = `/${normalizePattern(keyDir).replace(/^\/+/, '').replace(/\/+$/, '')}/`;
      const idx = filePath.indexOf(marker);
      if (idx > 0) {
        return filePath.slice(0, idx);
      }
    }
    return path.posix.dirname(filePath);
  }

  private rankSnippets(
    snippets: SubmissionFileSnippet[],
    projectContext: InferredProjectContext,
  ): Array<{ snippet: SubmissionFileSnippet; score: number }> {
    return snippets
      .map((snippet) => {
        const normalizedPath = normalizePathForMatch(snippet.relativePath);
        const ext = path.extname(normalizedPath);
        const baseName = path.basename(normalizedPath);
        const implementation = isImplementationPath(snippet.relativePath, projectContext);
        let score = 0;

        if (snippet.includeInSimilarity) score += 25;
        if (implementation) score += 120;
        if (matchesAnyPattern(snippet.relativePath, projectContext.prioritizePatterns)) score += 35;
        if (matchesAnyPattern(snippet.relativePath, projectContext.deprioritizePatterns)) score -= 45;
        if (isLikelyGeneratedPath(snippet.relativePath)) score -= 30;
        if (snippet.isMetadata) score -= 90;
        if (baseName.includes('main.') || baseName.includes('app.') || baseName.includes('index.')) score += 8;
        if (normalizedPath.includes('/src/')) score += 10;
        if (
          normalizedPath.includes('/test/') ||
          normalizedPath.includes('__tests__') ||
          normalizedPath.includes('.spec.') ||
          normalizedPath.includes('.test.')
        ) {
          score += implementation ? 8 : -4;
        }
        if (!projectContext.implementationExtensions.includes(ext) && CODE_EXTENSIONS.has(ext)) {
          score -= 8;
        }
        score += Math.min(10, Math.floor(snippet.content.length / 1200));

        return { snippet, score };
      })
      .sort((left, right) => right.score - left.score);
  }

  private enforceSelectionConstraints(
    initialSelection: SubmissionFileSnippet[],
    rankedSnippets: SubmissionFileSnippet[],
    projectContext: InferredProjectContext,
  ): SubmissionFileSnippet[] {
    const selected: SubmissionFileSnippet[] = [];
    const addIfMissing = (snippet: SubmissionFileSnippet) => {
      if (!selected.includes(snippet) && selected.length < MAX_FILES_FOR_AI_GRADING) {
        selected.push(snippet);
      }
    };

    for (const snippet of initialSelection) {
      addIfMissing(snippet);
    }

    const preferredMetadataSnippets = this.getPreferredMetadataSnippets(
      rankedSnippets,
      projectContext,
    );

    const implementationCandidates = rankedSnippets.filter((snippet) =>
      isImplementationPath(snippet.relativePath, projectContext),
    );
    const requiredImplementationCount = Math.min(
      MIN_IMPLEMENTATION_FILES_FOR_GRADING,
      implementationCandidates.length,
    );

    for (const implSnippet of implementationCandidates) {
      if (
        selected.filter((item) => isImplementationPath(item.relativePath, projectContext))
          .length >= requiredImplementationCount
      ) {
        break;
      }
      if (!selected.includes(implSnippet)) {
        if (selected.length >= MAX_FILES_FOR_AI_GRADING) {
          const replaceIndex = selected.findIndex(
            (item) => !isImplementationPath(item.relativePath, projectContext),
          );
          if (replaceIndex >= 0) {
            selected.splice(replaceIndex, 1, implSnippet);
          }
        } else {
          selected.push(implSnippet);
        }
      }
    }

    for (const snippet of preferredMetadataSnippets) {
      if (selected.filter((item) => item.isMetadata).length >= MAX_METADATA_FILES_FOR_GRADING) {
        break;
      }
      addIfMissing(snippet);
    }

    let metadataCount = selected.filter((snippet) => snippet.isMetadata).length;
    if (
      implementationCandidates.length > 0 &&
      metadataCount > MAX_METADATA_FILES_FOR_GRADING
    ) {
      const filtered = selected.filter((snippet) => !snippet.isMetadata);
      const metadataAllowed = selected
        .filter((snippet) => snippet.isMetadata)
        .slice(0, MAX_METADATA_FILES_FOR_GRADING);
      selected.length = 0;
      selected.push(...filtered, ...metadataAllowed);
      metadataCount = selected.filter((snippet) => snippet.isMetadata).length;
      void metadataCount;
    }

    const highValueCandidates = rankedSnippets.filter(
      (snippet) => !snippet.isMetadata && !isLikelyGeneratedPath(snippet.relativePath),
    );
    for (const snippet of highValueCandidates) {
      addIfMissing(snippet);
      if (selected.length >= MAX_FILES_FOR_AI_GRADING) break;
    }

    if (selected.filter((snippet) => snippet.isMetadata).length < MAX_METADATA_FILES_FOR_GRADING) {
      for (const snippet of rankedSnippets) {
        if (!snippet.isMetadata) continue;
        addIfMissing(snippet);
        break;
      }
    }

    if (selected.length < MIN_FILES_BEFORE_EARLY_STOP) {
      for (const snippet of rankedSnippets) {
        addIfMissing(snippet);
        if (selected.length >= MIN_FILES_BEFORE_EARLY_STOP) break;
      }
    }

    if (
      implementationCandidates.length > 0 &&
      !selected.some((snippet) => isImplementationPath(snippet.relativePath, projectContext))
    ) {
      selected.length = 0;
      for (const snippet of implementationCandidates) {
        addIfMissing(snippet);
        if (selected.length >= MAX_FILES_FOR_AI_GRADING) break;
      }
      for (const snippet of highValueCandidates) {
        addIfMissing(snippet);
        if (selected.length >= MAX_FILES_FOR_AI_GRADING) break;
      }
      for (const snippet of preferredMetadataSnippets) {
        if (selected.filter((item) => item.isMetadata).length >= MAX_METADATA_FILES_FOR_GRADING) {
          break;
        }
        addIfMissing(snippet);
      }
    }

    if (selected.length === 0) {
      return rankedSnippets.slice(0, Math.min(MAX_FILES_FOR_AI_GRADING, rankedSnippets.length));
    }

    return selected.slice(0, MAX_FILES_FOR_AI_GRADING);
  }

  private getPreferredMetadataSnippets(
    rankedSnippets: SubmissionFileSnippet[],
    projectContext: InferredProjectContext,
  ): SubmissionFileSnippet[] {
    const metadataSnippets = rankedSnippets.filter((snippet) => snippet.isMetadata);
    if (metadataSnippets.length === 0) {
      return [];
    }

    const preferredBasenames = this.getPreferredMetadataBasenames(projectContext.projectType);
    const preferred: SubmissionFileSnippet[] = [];

    for (const basename of preferredBasenames) {
      const matched = metadataSnippets.find(
        (snippet) => path.basename(normalizePathForMatch(snippet.relativePath)) === basename,
      );
      if (matched && !preferred.includes(matched)) {
        preferred.push(matched);
      }
    }

    if (preferred.length > 0) {
      return preferred;
    }

    return metadataSnippets.slice(0, 1);
  }

  private getPreferredMetadataBasenames(projectType: string): string[] {
    const type = (projectType || '').toLowerCase();
    if (type === 'flutter') {
      return ['pubspec.yaml', 'analysis_options.yaml', 'readme.md'];
    }
    if (type === 'angular' || type === 'nextjs' || type === 'node-web' || type === 'nestjs') {
      return ['package.json', 'tsconfig.json', 'readme.md'];
    }
    if (type === 'python') {
      return ['pyproject.toml', 'requirements.txt', 'readme.md'];
    }
    if (type === 'jvm') {
      return ['pom.xml', 'build.gradle', 'readme.md'];
    }
    if (type === 'dotnet') {
      return ['appsettings.json', 'readme.md'];
    }
    if (type === 'go') {
      return ['go.mod', 'readme.md'];
    }
    if (type === 'rust') {
      return ['cargo.toml', 'readme.md'];
    }
    if (type === 'php') {
      return ['composer.json', 'readme.md'];
    }
    return ['readme.md', 'package.json', 'tsconfig.json'];
  }

  private async gradeSingleSubmission(params: {
    provider: LlmProvider;
    providerName: LLMProviderType;
    modelName?: string;
    payload: GradeRequestPayload;
    rubric: GradingCriterion[];
    maxPossibleScore: number;
    prepared: SubmissionPreparedData;
    selectedSnippets: SubmissionFileSnippet[];
  }): Promise<BatchGradeResult['results'][number]['aiGradingResult']> {
    const {
      provider,
      providerName,
      modelName,
      payload,
      rubric,
      maxPossibleScore,
      prepared,
      selectedSnippets,
    } = params;

    const adaptivelyReadSnippets = await this.readSnippetsAdaptively({
      provider,
      providerName,
      payload,
      rubric,
      prepared,
      selectedSnippets,
    });

    const gradingSource = adaptivelyReadSnippets.map((snippet) => snippet.content).join('\n');
    if (!gradingSource.trim()) {
      throw new Error('Submission has no readable content for AI grading');
    }

    provider.init(ASSIGNMENT_GRADING_SYSTEM_PROMPT, [], []);

    const filesSection = adaptivelyReadSnippets
      .map((snippet) => `FILE: ${snippet.relativePath}\n---\n${snippet.content}`)
      .join('\n\n====================\n\n');

    const prompt = [
      `Assignment title: ${payload.assignmentTitle || '(untitled assignment)'}`,
      `Assignment description: ${payload.assignmentDescription || '(no description provided)'}`,
      `Rubric: ${JSON.stringify(rubric)}`,
      `Evaluated files (${adaptivelyReadSnippets.length}/${selectedSnippets.length}): ${adaptivelyReadSnippets.map((snippet) => snippet.relativePath).join(', ')}`,
      'Grade the submission based on the rubric.',
      'Return STRICT JSON with schema:',
      '{"criterionScores":[{"criterion":"string","score":number,"feedback":"string"}],"totalScore":number,"feedback":"string","strengths":["string"],"improvements":["string"],"confidence":number}',
      'Do not include markdown fences.',
      `Submission content:\n${filesSection}`,
    ].join('\n\n');

    const llmResponse = await this.sendProviderMessageWithRetry(
      provider,
      prompt,
      `grade submission ${prepared.submission.id}`,
      this.getLlmRequestOptions(providerName),
    );
    if (!llmResponse.text) {
      throw new Error('LLM returned no text response for grading');
    }
    if (llmResponse.toolCalls && llmResponse.toolCalls.length > 0) {
      throw new Error('Unexpected tool calls during grading response');
    }

    const parsed = await this.parseGradingJsonWithRepair(provider, llmResponse.text);
    const parsedCriterionScores = Array.isArray(parsed.criterionScores) ? parsed.criterionScores : [];

    let matchedCriteriaCount = 0;
    let criterionScores: LlmCriterionScore[] = rubric.map((criterion) => {
      const matched = findBestCriterionMatch(criterion, parsedCriterionScores);
      if (matched) matchedCriteriaCount += 1;
      return {
        criterion: criterion.criterion,
        maxScore: criterion.maxScore,
        score: Number(clamp(toNumber(matched?.score, 0), 0, criterion.maxScore).toFixed(2)),
        feedback: matched?.feedback,
      };
    });

    let totalScore = Number(
      clamp(
        criterionScores.reduce((sum, item) => sum + item.score, 0),
        0,
        maxPossibleScore,
      ).toFixed(2),
    );

    const parsedTotalScore =
      typeof parsed.totalScore === 'number' && Number.isFinite(parsed.totalScore)
        ? Number(clamp(parsed.totalScore, 0, maxPossibleScore).toFixed(2))
        : null;

    if (parsedTotalScore !== null && parsedTotalScore > 0 && matchedCriteriaCount === 0) {
      criterionScores = distributeTotalScoreByRubric(rubric, parsedTotalScore, maxPossibleScore);
      totalScore = Number(
        clamp(
          criterionScores.reduce((sum, item) => sum + item.score, 0),
          0,
          maxPossibleScore,
        ).toFixed(2),
      );
    }

    const feedback =
      typeof parsed.feedback === 'string' && parsed.feedback.trim().length > 0
        ? parsed.feedback.trim()
        : 'AI grading completed.';

    const strengths = Array.isArray(parsed.strengths)
      ? parsed.strengths.filter((item) => typeof item === 'string').slice(0, 8)
      : [];
    const improvements = Array.isArray(parsed.improvements)
      ? parsed.improvements.filter((item) => typeof item === 'string').slice(0, 8)
      : [];
    const confidence = Number(clamp(toNumber(parsed.confidence, 0.7), 0, 1).toFixed(3));

    return {
      rubricUsed: rubric,
      criterionScores,
      score: totalScore,
      maxScore: maxPossibleScore,
      percentageScore: Number(((totalScore / maxPossibleScore) * 100).toFixed(2)),
      feedback,
      strengths,
      improvements,
      confidence,
      evaluatedFileCount: adaptivelyReadSnippets.length,
      generatedAt: new Date().toISOString(),
      graderProvider: providerName,
      graderModel: modelName,
    };
  }

  private async readSnippetsAdaptively(params: {
    provider: LlmProvider;
    providerName: LLMProviderType;
    payload: GradeRequestPayload;
    rubric: GradingCriterion[];
    prepared: SubmissionPreparedData;
    selectedSnippets: SubmissionFileSnippet[];
  }): Promise<SubmissionFileSnippet[]> {
    const { provider, providerName, payload, rubric, prepared, selectedSnippets } = params;
    if (selectedSnippets.length <= 1) {
      for (const [index, snippet] of selectedSnippets.entries()) {
        console.log(
          `[AssignmentSubmissionGrader] reading file ${index + 1}/${selectedSnippets.length} for submission ${prepared.submission.id} (student ${prepared.submission.authorId}): ${snippet.relativePath}`,
        );
      }
      return selectedSnippets;
    }

    if (providerName === 'ollama') {
      const limitedSnippets = selectedSnippets.slice(
        0,
        Math.min(MAX_FILES_FOR_OLLAMA_GRADING, selectedSnippets.length),
      );
      console.log(
        `[AssignmentSubmissionGrader] ollama mode: skip adaptive-read decisions and use top ${limitedSnippets.length}/${selectedSnippets.length} files for submission ${prepared.submission.id}`,
      );
      for (const [index, snippet] of limitedSnippets.entries()) {
        console.log(
          `[AssignmentSubmissionGrader] reading file ${index + 1}/${limitedSnippets.length} for submission ${prepared.submission.id} (student ${prepared.submission.authorId}): ${snippet.relativePath}`,
        );
      }
      return limitedSnippets;
    }

    provider.init(ADAPTIVE_READING_SYSTEM_PROMPT, [], []);

    const candidateManifest = selectedSnippets
      .map((snippet, index) => `${index + 1}. ${snippet.relativePath}`)
      .join('\n');
    const bootstrapPrompt = [
      `Assignment title: ${payload.assignmentTitle || '(untitled assignment)'}`,
      `Assignment description: ${payload.assignmentDescription || '(no description provided)'}`,
      `Rubric: ${JSON.stringify(rubric)}`,
      'You will receive files one by one in ranked order.',
      `Candidate file order (${selectedSnippets.length} files):\n${candidateManifest}`,
      'Acknowledge with STRICT JSON: {"ack":true}',
    ].join('\n\n');

    const bootstrapResponse = await this.sendProviderMessageWithRetry(
      provider,
      bootstrapPrompt,
      `adaptive-read bootstrap for submission ${prepared.submission.id}`,
    );
    if (!bootstrapResponse.text) {
      throw new Error('LLM returned no text response for adaptive reading bootstrap');
    }
    if (bootstrapResponse.toolCalls && bootstrapResponse.toolCalls.length > 0) {
      throw new Error('Unexpected tool calls during adaptive reading bootstrap');
    }

    const readSnippets: SubmissionFileSnippet[] = [];
    let decisionParseFailures = 0;

    for (const [index, snippet] of selectedSnippets.entries()) {
      console.log(
        `[AssignmentSubmissionGrader] reading file ${index + 1}/${selectedSnippets.length} for submission ${prepared.submission.id} (student ${prepared.submission.authorId}): ${snippet.relativePath}`,
      );

      readSnippets.push(snippet);
      const remainingCount = selectedSnippets.length - readSnippets.length;
      if (remainingCount === 0) {
        break;
      }

      const implementationLikeCount = readSnippets.filter(
        (item) => !item.isMetadata && !isLikelyGeneratedPath(item.relativePath),
      ).length;
      const meetsStopGuards =
        readSnippets.length >= MIN_FILES_BEFORE_EARLY_STOP &&
        implementationLikeCount >= MIN_IMPLEMENTATION_FILES_BEFORE_EARLY_STOP;

      const decisionPrompt = [
        `FILE ${index + 1}/${selectedSnippets.length}: ${snippet.relativePath}`,
        `File content:\n${snippet.content}`,
        `Read files so far: ${readSnippets.map((item) => item.relativePath).join(', ')}`,
        `Remaining unread files: ${remainingCount}`,
        'Decide if you need to read more files before grading reliably against the rubric.',
        'If uncertain, set needsMoreFiles=true.',
        'If mostly metadata/config/scaffold files were read so far, set needsMoreFiles=true.',
        'Return STRICT JSON only with schema:',
        '{"needsMoreFiles":boolean,"reason":"string","confidence":number,"missingEvidence":["string"]}',
      ].join('\n\n');

      const decisionResponse = await this.sendProviderMessageWithRetry(
        provider,
        decisionPrompt,
        `adaptive-read decision ${index + 1}/${selectedSnippets.length} for submission ${prepared.submission.id}`,
      );
      if (!decisionResponse.text) {
        console.log(
          `[AssignmentSubmissionGrader] adaptive-read decision missing text for submission ${prepared.submission.id}; continue reading`,
        );
        continue;
      }
      if (decisionResponse.toolCalls && decisionResponse.toolCalls.length > 0) {
        throw new Error('Unexpected tool calls during adaptive reading decision');
      }

      let decision: LlmReadDecisionJson;
      try {
        decision = await this.parseReadDecisionJsonWithRepair(provider, decisionResponse.text);
        decisionParseFailures = 0;
      } catch (error: unknown) {
        decisionParseFailures += 1;
        if (meetsStopGuards && decisionParseFailures >= MAX_ADAPTIVE_DECISION_PARSE_FAILURES) {
          console.log(
            `[AssignmentSubmissionGrader] adaptive-read stop for submission ${prepared.submission.id} after ${readSnippets.length}/${selectedSnippets.length} files due to repeated decision parse failures (${decisionParseFailures})`,
          );
          break;
        }
        console.log(
          `[AssignmentSubmissionGrader] adaptive-read decision parse failed for submission ${prepared.submission.id}: ${errorMessage(error)}; continue reading`,
        );
        continue;
      }

      const needsMoreFiles = decision.needsMoreFiles !== false;

      if (!needsMoreFiles && meetsStopGuards) {
        console.log(
          `[AssignmentSubmissionGrader] adaptive-read stop for submission ${prepared.submission.id} after ${readSnippets.length}/${selectedSnippets.length} files. reason="${decision.reason || 'enough evidence'}" confidence=${Number(clamp(toNumber(decision.confidence, 0.7), 0, 1).toFixed(3))}`,
        );
        break;
      }

      const continueReason = needsMoreFiles
        ? decision.reason || 'AI requested more evidence'
        : 'stop request rejected by minimum evidence guard';
      console.log(
        `[AssignmentSubmissionGrader] adaptive-read continue for submission ${prepared.submission.id} after ${readSnippets.length}/${selectedSnippets.length} files. reason="${continueReason}"`,
      );
    }

    return readSnippets;
  }

  private async parseGradingJsonWithRepair(
    provider: LlmProvider,
    rawResponse: string,
  ): Promise<LlmGradeJson> {
    try {
      return this.validateGradingJsonPayload(extractAnyJsonObject(rawResponse));
    } catch (initialError: unknown) {
      const truncatedRaw =
        rawResponse.length > MAX_RAW_RESPONSE_CHARS_FOR_REPAIR
          ? `${rawResponse.slice(0, MAX_RAW_RESPONSE_CHARS_FOR_REPAIR)}\n... [truncated]`
          : rawResponse;

      const repairPrompt = [
        'Your previous grading response was not valid JSON.',
        'Rewrite it as STRICT JSON only (no markdown, no code fences, no extra text).',
        'Required schema:',
        '{"criterionScores":[{"criterion":"string","score":number,"feedback":"string"}],"totalScore":number,"feedback":"string","strengths":["string"],"improvements":["string"],"confidence":number}',
        'Previous response:',
        truncatedRaw,
      ].join('\n\n');

      const repairResponse = await this.sendProviderMessageWithRetry(
        provider,
        repairPrompt,
        'grading response repair',
      );
      if (!repairResponse.text) {
        throw new Error(
          `LLM grading response is not valid JSON: ${errorMessage(initialError)}`,
        );
      }
      if (repairResponse.toolCalls && repairResponse.toolCalls.length > 0) {
        throw new Error('Unexpected tool calls during grading response repair');
      }

      try {
        return this.validateGradingJsonPayload(extractAnyJsonObject(repairResponse.text));
      } catch (repairError: unknown) {
        throw new Error(`LLM grading response is not valid JSON: ${errorMessage(repairError)}`);
      }
    }
  }

  private async parseReadDecisionJsonWithRepair(
    provider: LlmProvider,
    rawResponse: string,
  ): Promise<LlmReadDecisionJson> {
    try {
      return this.validateReadDecisionPayload(extractAnyJsonObject(rawResponse));
    } catch (initialError: unknown) {
      const truncatedRaw =
        rawResponse.length > MAX_RAW_RESPONSE_CHARS_FOR_REPAIR
          ? `${rawResponse.slice(0, MAX_RAW_RESPONSE_CHARS_FOR_REPAIR)}\n... [truncated]`
          : rawResponse;

      const repairPrompt = [
        'Your previous adaptive-read decision was not valid JSON.',
        'Rewrite it as STRICT JSON only (no markdown, no code fences, no extra text).',
        'Required schema:',
        '{"needsMoreFiles":boolean,"reason":"string","confidence":number,"missingEvidence":["string"]}',
        'Previous response:',
        truncatedRaw,
      ].join('\n\n');

      const repairResponse = await this.sendProviderMessageWithRetry(
        provider,
        repairPrompt,
        'adaptive-read decision repair',
      );
      if (!repairResponse.text) {
        throw new Error(
          `LLM adaptive-read decision is not valid JSON: ${errorMessage(initialError)}`,
        );
      }
      if (repairResponse.toolCalls && repairResponse.toolCalls.length > 0) {
        throw new Error('Unexpected tool calls during adaptive-read decision repair');
      }

      try {
        return this.validateReadDecisionPayload(extractAnyJsonObject(repairResponse.text));
      } catch (repairError: unknown) {
        throw new Error(
          `LLM adaptive-read decision is not valid JSON: ${errorMessage(repairError)}`,
        );
      }
    }
  }

  private async prepareSubmissionData(params: {
    client: ReturnType<typeof createInternalClient>;
    payload: GradeRequestPayload;
    submission: CourseAssignmentSubmission;
    tempRoot: string;
  }): Promise<SubmissionPreparedData> {
    const { client, payload, submission, tempRoot } = params;
    const submissionDir = path.join(tempRoot, submission.id);
    await fs.mkdir(submissionDir, { recursive: true });

    const extractedRoots: string[] = [];

    for (let i = 0; i < (submission.submissionFiles || []).length; i++) {
      const file = submission.submissionFiles![i];
      const localFileName = `${i}-${safeFileName(file.fileName || `file-${i}`)}`;
      const localFilePath = path.join(submissionDir, localFileName);

      const response = await this.executeWithRetry({
        label: `download submission ${submission.id} file ${i + 1}`,
        timeoutMs: DOWNLOAD_REQUEST_TIMEOUT_MS,
        operation: () =>
          client.get(
            `/courses/${payload.courseId}/lessons/${payload.lessonId}/assignments/${payload.assignmentId}/submissions/${submission.id}/download`,
            {
              params: { fileIndex: i },
              responseType: 'arraybuffer',
              timeout: DOWNLOAD_REQUEST_TIMEOUT_MS,
            },
          ),
      });

      await fs.writeFile(localFilePath, Buffer.from(response.data));

      if (isZipFile(file)) {
        const unzipTarget = path.join(submissionDir, `unzipped-${i}`);
        await fs.mkdir(unzipTarget, { recursive: true });
        try {
          await this.validateZipEntriesSafety(localFilePath);
          await execFileAsync('unzip', ['-oq', localFilePath, '-d', unzipTarget], {
            maxBuffer: 10 * 1024 * 1024,
            timeout: DOWNLOAD_REQUEST_TIMEOUT_MS,
          });
          extractedRoots.push(unzipTarget);
        } catch (error: unknown) {
          throw new Error(`Unable to extract zip file "${file.fileName}": ${errorMessage(error)}`);
        }
      } else {
        extractedRoots.push(localFilePath);
      }
    }

    const snippets: SubmissionFileSnippet[] = [];
    let totalChars = 0;

    if (submission.content?.trim()) {
      const content = submission.content.trim().slice(0, MAX_FILE_CHARS);
      snippets.push({
        relativePath: 'submission-content.txt',
        content,
        includeInSimilarity: false,
        isMetadata: false,
      });
      totalChars += content.length;
    }

    for (const root of extractedRoots) {
      const stat = await fs.stat(root);
      const candidatePaths = stat.isDirectory() ? await this.collectFiles(root) : [root];

      for (const candidatePath of candidatePaths) {
        if (snippets.length >= MAX_FILES_PER_SUBMISSION) {
          break;
        }

        const fileStat = await fs.stat(candidatePath);
        if (fileStat.size > MAX_FILE_BYTES) continue;
        if (!shouldIncludeFile(candidatePath, fileStat.size)) continue;

        const buffer = await fs.readFile(candidatePath);
        if (!isLikelyText(buffer)) continue;

        let content = buffer.toString('utf8').replace(/\r\n/g, '\n').trim();
        if (!content) continue;

        if (content.length > MAX_FILE_CHARS) {
          content = `${content.slice(0, MAX_FILE_CHARS)}\n\n/* truncated for grading */`;
        }
        if (totalChars + content.length > MAX_TOTAL_CHARS) continue;

        const relativePath = path.relative(submissionDir, candidatePath);
        const isMetadata = isMetadataPath(relativePath);
        const includeInSimilarity =
          CODE_EXTENSIONS.has(path.extname(normalizePathForMatch(relativePath))) && !isMetadata;

        snippets.push({
          relativePath,
          content,
          includeInSimilarity,
          isMetadata,
        });
        totalChars += content.length;
      }
    }

    const combinedSource = snippets.map((item) => item.content).join('\n');
    const similaritySource = snippets
      .filter((item) => item.includeInSimilarity)
      .map((item) => item.content)
      .join('\n');
    const similarityTokens = tokenize(normalizeForSimilarity(similaritySource));

    return {
      submission,
      snippets,
      similarityTokens,
      combinedSource,
    };
  }

  private async collectFiles(root: string): Promise<string[]> {
    const files: string[] = [];
    const queue = [root];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const entries = (await fs.readdir(current, { withFileTypes: true }))
        .sort((left, right) => left.name.localeCompare(right.name));

      for (const entry of entries) {
        if (entry.name.startsWith('.DS_Store')) continue;
        const fullPath = path.join(current, entry.name);

        if (entry.isDirectory()) {
          if (!IGNORED_DIRS.has(entry.name.toLowerCase())) {
            queue.push(fullPath);
          }
          continue;
        }
        if (entry.isFile()) {
          files.push(fullPath);
        }
      }
    }

    return files.sort((left, right) => left.localeCompare(right));
  }

  private computeSimilarityMatches(
    targetSubmissionId: string,
    preparedMap: Map<string, SubmissionPreparedData>,
    threshold: number,
  ): Array<{ submissionId: string; authorId: string; similarity: number }> {
    const target = preparedMap.get(targetSubmissionId);
    if (!target || target.similarityTokens.size < MIN_SIMILARITY_TOKEN_COUNT) {
      return [];
    }

    const matches: Array<{ submissionId: string; authorId: string; similarity: number }> = [];

    for (const [candidateId, candidate] of preparedMap.entries()) {
      if (candidateId === targetSubmissionId) continue;
      if (candidate.similarityTokens.size < MIN_SIMILARITY_TOKEN_COUNT) continue;

      const similarity = jaccardSimilarity(target.similarityTokens, candidate.similarityTokens);
      if (similarity >= threshold) {
        matches.push({
          submissionId: candidateId,
          authorId: candidate.submission.authorId,
          similarity: Number(similarity.toFixed(4)),
        });
      }
    }

    return matches
      .sort((left, right) => right.similarity - left.similarity)
      .slice(0, MAX_SIMILARITY_MATCHES);
  }

  private pruneCommonSimilarityTokens(preparedMap: Map<string, SubmissionPreparedData>): void {
    if (preparedMap.size <= 1) return;

    const tokenFrequency = new Map<string, number>();
    for (const prepared of preparedMap.values()) {
      for (const token of prepared.similarityTokens) {
        tokenFrequency.set(token, (tokenFrequency.get(token) || 0) + 1);
      }
    }

    const maxCommonCount = Math.max(1, Math.floor(preparedMap.size * 0.8));
    for (const prepared of preparedMap.values()) {
      prepared.similarityTokens = new Set(
        Array.from(prepared.similarityTokens).filter(
          (token) => (tokenFrequency.get(token) || 0) <= maxCommonCount,
        ),
      );
    }
  }

}
