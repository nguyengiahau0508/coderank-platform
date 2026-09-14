import { ZodTypeAny } from 'zod';
import type { AxiosInstance } from 'axios';
import { PermissionMode } from '../permissions';

export type IApiClient = AxiosInstance;

export interface ITool {
  name: string;
  description: string;
  parameters: ZodTypeAny;
  /** Optional permission mode required for this tool. Defaults to ReadOnly if not specified. */
  permissionMode?: PermissionMode;
  execute(args: unknown, client: IApiClient): Promise<unknown>;
}
