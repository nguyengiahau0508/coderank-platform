import { Module } from '@nestjs/common';
import { CoderankProblemsApiService } from './coderank-problems-api.service';
import { AgentApiController } from './agent-api.controller';
import { AgentSecretGuard } from './agent-secret.guard';

@Module({
  controllers: [AgentApiController],
  providers: [CoderankProblemsApiService, AgentSecretGuard],
  exports: [CoderankProblemsApiService, AgentSecretGuard],
})
export class ApiModule {}
