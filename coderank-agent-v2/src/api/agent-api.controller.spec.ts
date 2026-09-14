import { Test, TestingModule } from '@nestjs/testing';
import { AgentApiController } from './agent-api.controller';
import { AgentSecretGuard } from './agent-secret.guard';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { config } from '../config';

describe('AgentApiController & AgentSecretGuard', () => {
  let controller: AgentApiController;
  let guard: AgentSecretGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AgentApiController],
      providers: [AgentSecretGuard],
    }).compile();

    controller = module.get<AgentApiController>(AgentApiController);
    guard = module.get<AgentSecretGuard>(AgentSecretGuard);
  });

  describe('health', () => {
    it('should return status ok', () => {
      expect(controller.health()).toEqual({ status: 'ok' });
    });
  });

  describe('AgentSecretGuard', () => {
    it('should throw ForbiddenException if secret is missing or invalid', () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: { 'x-agent-secret': 'wrong-secret' },
          }),
        }),
      } as unknown as ExecutionContext;

      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
    });

    it('should allow if secret matches config', () => {
      const originalSecret = config.AGENT_SECRET_TOKEN;
      (config as any).AGENT_SECRET_TOKEN = 'test-secret';

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: { 'x-agent-secret': 'test-secret' },
          }),
        }),
      } as unknown as ExecutionContext;

      expect(guard.canActivate(mockContext)).toBe(true);
      (config as any).AGENT_SECRET_TOKEN = originalSecret;
    });
  });
});
