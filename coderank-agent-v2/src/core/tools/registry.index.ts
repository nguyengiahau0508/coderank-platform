export type { ITool, IApiClient } from './tool.interface';
export { BaseTool } from './base/base.tool';
export { ToolRegistry } from './tool.registry';

import { ToolRegistry } from './tool.registry';
import { problemTools } from './problems/problems.tool';
import { courseTools } from './courses/courses.tool';
import { 
  CodeAnalysisTool, 
  ComplexityAnalysisTool, 
  CodeQualityTool,
  AlgorithmSuggestionTool,
  DataStructureSuggestionTool,
  ProblemGeneratorTool,
} from './ai-analysis';

// AI Analysis tools
const aiAnalysisTools = [
  new CodeAnalysisTool(),
  new ComplexityAnalysisTool(),
  new CodeQualityTool(),
  new AlgorithmSuggestionTool(),
  new DataStructureSuggestionTool(),
  new ProblemGeneratorTool(),
];

/**
 * Registers all tools from every domain into the given registry.
 * When adding a new domain, import its tool array here and spread it below.
 */
export function registerAllTools(registry: ToolRegistry): void {
  registry.registerMany([
    ...problemTools,
    ...courseTools,
    ...aiAnalysisTools,
  ]);
}
