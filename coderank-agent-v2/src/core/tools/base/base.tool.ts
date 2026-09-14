import { ZodTypeAny } from 'zod';
import { ITool, IApiClient } from '../tool.interface';
import { PermissionMode } from '../../permissions';

/**
 * Abstract base class for all tools.
 *
 * Concrete tools extend this class and implement `run()`.
 * Zod validation is handled automatically in `execute()` before `run()` is called,
 * so `run()` always receives validated, type-safe arguments.
 *
 * @example
 * export class MyTool extends BaseTool {
 *   readonly name = 'my_tool';
 *   readonly description = '...';
 *   readonly parameters = z.object({ id: z.string() });
 *   readonly permissionMode = PermissionMode.ReadOnly;
 *
 *   protected async run(args: { id: string }, client: IApiClient) {
 *     const res = await client.get(`/resource/${args.id}`);
 *     return res.data;
 *   }
 * }
 */
export abstract class BaseTool implements ITool {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly parameters: ZodTypeAny;
  /** Permission mode required for this tool. Override in subclass if needed. */
  readonly permissionMode: PermissionMode = PermissionMode.ReadOnly;

  async execute(args: unknown, client: IApiClient): Promise<unknown> {
    const validatedArgs = this.parameters.parse(args ?? {});
    return this.run(validatedArgs, client);
  }

  protected abstract run(args: any, client: IApiClient): Promise<unknown>;
}
