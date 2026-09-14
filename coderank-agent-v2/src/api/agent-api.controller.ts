import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AgentSecretGuard } from './agent-secret.guard';
import { Agent } from '../core/agent/agent';
import { AssignmentSubmissionGrader } from '../core/agent/assignment-submission-grader';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Controller()
export class AgentApiController {
  @Get('health')
  health() {
    return { status: 'ok' };
  }

  @Post('agent/chat')
  @UseGuards(AgentSecretGuard)
  async chat(@Body() body: any, @Res() res: Response) {
    const {
      userToken,
      message,
      role,
      provider,
      modelName,
      apiKey,
      baseHost,
      contextPolicy,
      history,
      context,
    } = body ?? {};

    if (!userToken || !message) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        error: 'Missing userToken or message',
      });
    }

    const llmConfig =
      apiKey || baseHost || contextPolicy || history
        ? { apiKey, baseHost, contextPolicy, initialHistory: history }
        : undefined;

    try {
      const agent = new Agent(role, provider, modelName, llmConfig);
      const responseText = await agent.processQuery(userToken, message, context);

      return res.json({
        success: true,
        data: { message: responseText },
      });
    } catch (error: any) {
      console.error(`[Agent Error]: ${error.message}`);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Internal Agent Error',
        details: error.message,
      });
    }
  }

  @Post('agent/chat/stream')
  @UseGuards(AgentSecretGuard)
  async chatStream(@Body() body: any, @Res() res: Response) {
    const {
      userToken,
      message,
      role,
      provider,
      modelName,
      apiKey,
      baseHost,
      contextPolicy,
      history,
      context,
    } = body ?? {};

    if (!userToken || !message) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        error: 'Missing userToken or message',
      });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const sendEvent = (event: { type: string; content?: string }) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    const llmConfig =
      apiKey || baseHost || contextPolicy || history
        ? { apiKey, baseHost, contextPolicy, initialHistory: history }
        : undefined;

    try {
      const agent = new Agent(role, provider, modelName, llmConfig);
      const responseText = await agent.processQueryStream(
        userToken,
        message,
        sendEvent,
        context,
      );

      // Stream final text word-by-word
      const words = responseText.split(/(?<=\s)/);
      for (const word of words) {
        sendEvent({ type: 'token', content: word });
        await sleep(15);
      }

      sendEvent({ type: 'done' });
      res.end();
    } catch (error: any) {
      console.error(`[Agent Stream Error]: ${error.message}`);
      sendEvent({ type: 'error', content: error.message });
      res.end();
    }
  }

  @Post('agent/grade-assignment-submissions')
  @UseGuards(AgentSecretGuard)
  async gradeAssignmentSubmissions(@Body() body: any, @Res() res: Response) {
    const {
      userToken,
      role,
      provider,
      modelName,
      apiKey,
      baseHost,
      courseId,
      lessonId,
      assignmentId,
      submissionIds,
      similarityThreshold,
      defaultMaxScore,
      gradingCriteria,
      assignmentTitle,
      assignmentDescription,
    } = body ?? {};

    if (!userToken || !courseId || !lessonId || !assignmentId) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        error:
          'Missing required fields: userToken, courseId, lessonId, assignmentId',
      });
    }

    try {
      const grader = new AssignmentSubmissionGrader();
      const result = await grader.grade({
        userToken,
        role,
        provider,
        modelName,
        apiKey,
        baseHost,
        courseId,
        lessonId,
        assignmentId,
        submissionIds,
        similarityThreshold,
        defaultMaxScore,
        gradingCriteria,
        assignmentTitle,
        assignmentDescription,
      });

      return res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error(`[Assignment Grading Error]: ${error.message}`);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Assignment grading failed',
        details: error.message,
      });
    }
  }
}
