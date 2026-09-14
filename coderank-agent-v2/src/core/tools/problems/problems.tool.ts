import { z } from 'zod';
import { BaseTool } from '../base/base.tool';
import { IApiClient, ITool } from '../tool.interface';
import {
  CreateProblemSchema,
  UpdateProblemSchema,
  CreateTestcaseSchema,
  UpdateTestcaseSchema,
  CreateHintSchema,
  UpdateHintSchema,
  CreateSubmissionSchema,
  CreateSolutionSchema,
  UpdateSolutionSchema,
  PaginationQueryProblemsSchema,
} from './problems.schema';

// ─── Problem Tools ───────────────────────────────────────────────────────────

class GetMyProblemsTool extends BaseTool {
  readonly name = 'get_my_problems';
  readonly description =
    'Get a paginated list of problems created by the current user. ' +
    'Use this when the user asks for "my problems", "problems I created", or "problems I authored".';
  readonly parameters = PaginationQueryProblemsSchema;

  protected async run(args: z.infer<typeof PaginationQueryProblemsSchema>, client: IApiClient) {
    const response = await client.get('/problems/me', { params: args });
    return response.data;
  }
}

class GetProblemsTool extends BaseTool {
  readonly name = 'get_problems';
  readonly description =
    'Get a paginated list of all published problems. ' +
    'Use this when the user wants to browse, search, or filter the problem bank.';
  readonly parameters = PaginationQueryProblemsSchema;

  protected async run(args: z.infer<typeof PaginationQueryProblemsSchema>, client: IApiClient) {
    const response = await client.get('/problems', { params: args });
    return response.data;
  }
}

class GetProblemTool extends BaseTool {
  readonly name = 'get_problem';
  readonly description =
    'Get the full details of a single problem including description, constraints, tags and hints. ' +
    'Use this when the user asks about a specific problem by its ID.';
  readonly parameters = z.object({
    problemId: z.string().describe('The unique ID of the problem'),
  });

  protected async run(args: { problemId: string }, client: IApiClient) {
    const response = await client.get(`/problems/${args.problemId}`);
    return response.data;
  }
}

class CreateProblemTool extends BaseTool {
  readonly name = 'create_problem';

  readonly description =
    'Create a new coding problem.\n\n' +
    'You MUST provide ALL fields below (camelCase only):\n' +
    '- title (string): Problem title\n' +
    '- slug (string): URL slug generated from title (lowercase, kebab-case)\n' +
    '- description (string): Full problem statement in html\n' +
    '- inputDescription (string): Input format description\n' +
    '- outputDescription (string): Output format description\n' +
    '- timeLimitMs (number): Time limit in milliseconds (e.g. 1000)\n' +
    '- memoryLimitMb (number): Memory limit in MB (e.g. 256)\n' +
    '- difficulty (string): Must be exactly "easy", "medium", or "hard"\n' +
    '- isPublished (boolean)\n' +
    '- points (number)\n\n' +
    'Slug rules:\n' +
    '- Convert title to lowercase\n' +
    '- Replace spaces with "-"\n' +
    '- Remove special characters\n';

  readonly parameters = CreateProblemSchema;

  protected async run(
    args: z.infer<typeof CreateProblemSchema>,
    client: IApiClient
  ) {
    const response = await client.post('/problems', args);
    return response.data;
  }
}

class UpdateProblemTool extends BaseTool {
  readonly name = 'update_problem';
  readonly description =
    'Update an existing problem by its ID. ' +
    'Use this when the user wants to edit a problem\'s title, description, constraints, or other fields.';
  readonly parameters = z.object({
    problemId: z.string().describe('The unique ID of the problem to update'),
  }).merge(UpdateProblemSchema);

  protected async run(args: z.infer<typeof UpdateProblemSchema> & { problemId: string }, client: IApiClient) {
    const { problemId, ...body } = args;
    const response = await client.patch(`/problems/${problemId}`, body);
    return response.data;
  }
}

class DeleteProblemTool extends BaseTool {
  readonly name = 'delete_problem';
  readonly description =
    'Delete a problem by its ID. ' +
    'Use this when the user wants to remove a problem from the platform.';
  readonly parameters = z.object({
    problemId: z.string().describe('The unique ID of the problem to delete'),
  });

  protected async run(args: { problemId: string }, client: IApiClient) {
    const response = await client.delete(`/problems/${args.problemId}`);
    return response.data;
  }
}

// ─── Tag Tools ───────────────────────────────────────────────────────────────

class GetAllTagsTool extends BaseTool {
  readonly name = 'get_all_tags';
  readonly description =
    'Get all available problem tags (categories). ' +
    'Use this when the user asks what topics or tags exist.';
  readonly parameters = z.object({});

  protected async run(_args: Record<string, never>, client: IApiClient) {
    const response = await client.get('/problems/tags');
    return response.data;
  }
}

class AddTagToProblemTool extends BaseTool {
  readonly name = 'add_tag_to_problem';
  readonly description =
    'Add a tag to a problem. ' +
    'Use this when the user wants to associate an existing tag with a problem.';
  readonly parameters = z.object({
    problemId: z.string().describe('The unique ID of the problem'),
    tagId: z.string().describe('The unique ID of the tag to add'),
  });

  protected async run(args: { problemId: string; tagId: string }, client: IApiClient) {
    const response = await client.post(`/problems/${args.problemId}/tags/${args.tagId}`);
    return response.data;
  }
}

class RemoveTagFromProblemTool extends BaseTool {
  readonly name = 'remove_tag_from_problem';
  readonly description =
    'Remove a tag from a problem. ' +
    'Use this when the user wants to disassociate a tag from a problem.';
  readonly parameters = z.object({
    problemId: z.string().describe('The unique ID of the problem'),
    tagId: z.string().describe('The unique ID of the tag to remove'),
  });

  protected async run(args: { problemId: string; tagId: string }, client: IApiClient) {
    const response = await client.delete(`/problems/${args.problemId}/tags/${args.tagId}`);
    return response.data;
  }
}

// ─── Testcase Tools ──────────────────────────────────────────────────────────

class CreateTestcaseTool extends BaseTool {
  readonly name = 'create_testcase';

  readonly description =
    'Create a new testcase for a problem. ' +
    'Required fields: problemId (UUID of the problem), input (string), expectedOutput (string). ' +
    'IMPORTANT: the expected output field is named "expectedOutput", NOT "output". ' +
    'Optional fields: isSample (boolean, defaults to false), compareType ("exact"|"trim_whitespace"|"tokenize", defaults to "exact").';

  readonly parameters = z.object({
    problemId: z.string().describe('The unique ID of the problem'),
    ...CreateTestcaseSchema.shape,
  });

  protected async run(
    args: z.infer<typeof CreateTestcaseSchema> & { problemId: string },
    client: IApiClient
  ) {
    const { problemId, ...body } = args;
    const response = await client.post(`/problems/${problemId}/testcase`, body);
    return response.data;
  }
}

class CreateTestcasesTool extends BaseTool {
  readonly name = 'create_testcases';
  readonly description =
    'Create multiple testcases for a problem in a single API call. ' +
    'The input is an array of testcases, each with the same fields as create_testcase. ' +
    'This is more efficient than calling create_testcase multiple times. ' +
    'Required fields for each testcase: input (string), expectedOutput (string). ' +
    'Optional fields for each testcase: isSample (boolean, defaults to false), compareType ("exact"|"trim_whitespace"|"tokenize", defaults to "exact").';
  readonly parameters = z.object({
    problemId: z.string().describe('The unique ID of the problem'),
    testcases: z.array(CreateTestcaseSchema).describe('Array of testcases to create'),
  });

  protected async run(args: { problemId: string; testcases: z.infer<typeof CreateTestcaseSchema>[] }, client: IApiClient) {
    const { problemId, testcases } = args;
    const response = await client.post(`/problems/${problemId}/testcases`, { testcases });
    return response.data;
  }
}

class GetTestcasesTool extends BaseTool {
  readonly name = 'get_testcases';
  readonly description =
    'Get all testcases for a problem (including hidden ones). Requires owner/admin role. ' +
    'Use this when the problem author wants to see all testcases.';
  readonly parameters = z.object({
    problemId: z.string().describe('The unique ID of the problem'),
  });

  protected async run(args: { problemId: string }, client: IApiClient) {
    const response = await client.get(`/problems/${args.problemId}/testcases`);
    return response.data;
  }
}

class GetSampleTestcasesTool extends BaseTool {
  readonly name = 'get_sample_testcases';
  readonly description =
    'Get the sample (public) test cases for a problem, including input and expected output. ' +
    'Use this when the user wants to see example inputs/outputs for a problem.';
  readonly parameters = z.object({
    problemId: z.string().describe('The unique ID of the problem'),
  });

  protected async run(args: { problemId: string }, client: IApiClient) {
    const response = await client.get(`/problems/${args.problemId}/testcases/sample`);
    return response.data;
  }
}

class GetTestcaseTool extends BaseTool {
  readonly name = 'get_testcase';
  readonly description =
    'Get a single testcase by its ID. Requires owner/admin role. ' +
    'Use this when the user wants to inspect a specific testcase\'s input and expected output.';
  readonly parameters = z.object({
    problemId: z.string().describe('The unique ID of the problem'),
    testcaseId: z.string().describe('The unique ID of the testcase'),
  });

  protected async run(args: { problemId: string; testcaseId: string }, client: IApiClient) {
    const response = await client.get(
      `/problems/${args.problemId}/testcases/${args.testcaseId}`,
    );
    return response.data;
  }
}

class UpdateTestcaseTool extends BaseTool {
  readonly name = 'update_testcase';
  readonly description =
    'Update an existing testcase. ' +
    'Use this when the user wants to modify a testcase\'s input, expected output, or other fields.';
  readonly parameters = z.object({
    problemId: z.string().describe('The unique ID of the problem'),
    testcaseId: z.string().describe('The unique ID of the testcase to update'),
  }).merge(UpdateTestcaseSchema);

  protected async run(
    args: z.infer<typeof UpdateTestcaseSchema> & { problemId: string; testcaseId: string },
    client: IApiClient,
  ) {
    const { problemId, testcaseId, ...body } = args;
    const response = await client.patch(
      `/problems/${problemId}/testcases/${testcaseId}`,
      body,
    );
    return response.data;
  }
}

class DeleteTestcaseTool extends BaseTool {
  readonly name = 'delete_testcase';
  readonly description =
    'Delete a testcase from a problem. ' +
    'Use this when the user wants to remove a specific testcase.';
  readonly parameters = z.object({
    problemId: z.string().describe('The unique ID of the problem'),
    testcaseId: z.string().describe('The unique ID of the testcase to delete'),
  });

  protected async run(args: { problemId: string; testcaseId: string }, client: IApiClient) {
    const response = await client.delete(
      `/problems/${args.problemId}/testcases/${args.testcaseId}`,
    );
    return response.data;
  }
}

// ─── Hint Tools ──────────────────────────────────────────────────────────────

class CreateHintTool extends BaseTool {
  readonly name = 'create_hint';
  readonly description =
    'Create a new hint for a problem. ' +
    'Use this when the user wants to add a hint to help solvers.';
  readonly parameters = z.object({
    problemId: z.string().describe('The unique ID of the problem'),
  }).merge(CreateHintSchema);

  protected async run(args: z.infer<typeof CreateHintSchema> & { problemId: string }, client: IApiClient) {
    const { problemId, ...body } = args;
    const response = await client.post(`/problems/${problemId}/hints`, body);
    return response.data;
  }
}

class GetHintsTool extends BaseTool {
  readonly name = 'get_hints';
  readonly description =
    'Get all hints for a problem in order. ' +
    'Use this when the user asks for hints on a specific problem.';
  readonly parameters = z.object({
    problemId: z.string().describe('The unique ID of the problem'),
  });

  protected async run(args: { problemId: string }, client: IApiClient) {
    const response = await client.get(`/problems/${args.problemId}/hints`);
    return response.data;
  }
}

class GetHintTool extends BaseTool {
  readonly name = 'get_hint';
  readonly description =
    'Get a single hint by its ID. ' +
    'Use this when the user wants to inspect a specific hint.';
  readonly parameters = z.object({
    problemId: z.string().describe('The unique ID of the problem'),
    hintId: z.string().describe('The unique ID of the hint'),
  });

  protected async run(args: { problemId: string; hintId: string }, client: IApiClient) {
    const response = await client.get(
      `/problems/${args.problemId}/hints/${args.hintId}`,
    );
    return response.data;
  }
}

class UpdateHintTool extends BaseTool {
  readonly name = 'update_hint';
  readonly description =
    'Update an existing hint. ' +
    'Use this when the user wants to modify a hint\'s content or order.';
  readonly parameters = z.object({
    problemId: z.string().describe('The unique ID of the problem'),
    hintId: z.string().describe('The unique ID of the hint to update'),
  }).merge(UpdateHintSchema);

  protected async run(
    args: z.infer<typeof UpdateHintSchema> & { problemId: string; hintId: string },
    client: IApiClient,
  ) {
    const { problemId, hintId, ...body } = args;
    const response = await client.patch(
      `/problems/${problemId}/hints/${hintId}`,
      body,
    );
    return response.data;
  }
}

class DeleteHintTool extends BaseTool {
  readonly name = 'delete_hint';
  readonly description =
    'Delete a hint from a problem. ' +
    'Use this when the user wants to remove a specific hint.';
  readonly parameters = z.object({
    problemId: z.string().describe('The unique ID of the problem'),
    hintId: z.string().describe('The unique ID of the hint to delete'),
  });

  protected async run(args: { problemId: string; hintId: string }, client: IApiClient) {
    const response = await client.delete(
      `/problems/${args.problemId}/hints/${args.hintId}`,
    );
    return response.data;
  }
}

// ─── Submission Tools ────────────────────────────────────────────────────────

class SubmitProblemTool extends BaseTool {
  readonly name = 'submit_problem';
  readonly description =
    'Submit a code solution for a problem. ' +
    'Use this when the user wants to submit their code to be judged.';
  readonly parameters = z.object({
    problemId: z.string().describe('The unique ID of the problem'),
  }).merge(CreateSubmissionSchema);

  protected async run(
    args: z.infer<typeof CreateSubmissionSchema> & { problemId: string },
    client: IApiClient,
  ) {
    const { problemId, ...body } = args;
    const response = await client.post(`/problems/${problemId}/submissions`, body);
    return response.data;
  }
}

class GetMySubmissionsTool extends BaseTool {
  readonly name = 'get_my_submissions';
  readonly description =
    'Get all of the current user\'s submissions for a specific problem, ordered by newest first. ' +
    'Use this when the user asks about their submission history or results for a problem.';
  readonly parameters = z.object({
    problemId: z.string().describe('The unique ID of the problem'),
  });

  protected async run(args: { problemId: string }, client: IApiClient) {
    const response = await client.get(`/problems/${args.problemId}/submissions`);
    return response.data;
  }
}

class GetSubmissionTool extends BaseTool {
  readonly name = 'get_submission';
  readonly description =
    'Get the details of a single submission by its ID. ' +
    'Use this when the user wants to inspect a specific submission result.';
  readonly parameters = z.object({
    problemId: z.string().describe('The unique ID of the problem'),
    submissionId: z.string().describe('The unique ID of the submission'),
  });

  protected async run(args: { problemId: string; submissionId: string }, client: IApiClient) {
    const response = await client.get(
      `/problems/${args.problemId}/submissions/${args.submissionId}`,
    );
    return response.data;
  }
}

// ─── Solution Tools ──────────────────────────────────────────────────────────

class CreateSolutionTool extends BaseTool {
  readonly name = 'create_solution';
  readonly description =
    'Create a new solution for a problem. ' +
    'Use this when the user wants to share their solution with the community.';
  readonly parameters = z.object({
    problemId: z.string().describe('The unique ID of the problem'),
  }).merge(CreateSolutionSchema);

  protected async run(
    args: z.infer<typeof CreateSolutionSchema> & { problemId: string },
    client: IApiClient,
  ) {
    const { problemId, ...body } = args;
    const response = await client.post(`/problems/${problemId}/solutions`, body);
    return response.data;
  }
}

class GetSolutionsTool extends BaseTool {
  readonly name = 'get_solutions';
  readonly description =
    'Get all community solutions for a problem. ' +
    'Use this when the user wants to see how others solved a problem.';
  readonly parameters = z.object({
    problemId: z.string().describe('The unique ID of the problem'),
  });

  protected async run(args: { problemId: string }, client: IApiClient) {
    const response = await client.get(`/problems/${args.problemId}/solutions`);
    return response.data;
  }
}

class GetMySolutionsTool extends BaseTool {
  readonly name = 'get_my_solutions';
  readonly description =
    "Get the current user's own solutions for a specific problem. " +
    'Use this when the user asks about solutions they have written or shared.';
  readonly parameters = z.object({
    problemId: z.string().describe('The unique ID of the problem'),
  });

  protected async run(args: { problemId: string }, client: IApiClient) {
    const response = await client.get(`/problems/${args.problemId}/solutions/me`);
    return response.data;
  }
}

class GetSolutionTool extends BaseTool {
  readonly name = 'get_solution';
  readonly description =
    'Get a single solution by its ID. ' +
    'Use this when the user wants to inspect a specific solution in detail.';
  readonly parameters = z.object({
    problemId: z.string().describe('The unique ID of the problem'),
    solutionId: z.string().describe('The unique ID of the solution'),
  });

  protected async run(args: { problemId: string; solutionId: string }, client: IApiClient) {
    const response = await client.get(
      `/problems/${args.problemId}/solutions/${args.solutionId}`,
    );
    return response.data;
  }
}

class UpdateSolutionTool extends BaseTool {
  readonly name = 'update_solution';
  readonly description =
    'Update an existing solution. ' +
    'Use this when the user wants to edit their solution\'s title, description, or code.';
  readonly parameters = z.object({
    problemId: z.string().describe('The unique ID of the problem'),
    solutionId: z.string().describe('The unique ID of the solution to update'),
  }).merge(UpdateSolutionSchema);

  protected async run(
    args: z.infer<typeof UpdateSolutionSchema> & { problemId: string; solutionId: string },
    client: IApiClient,
  ) {
    const { problemId, solutionId, ...body } = args;
    const response = await client.patch(
      `/problems/${problemId}/solutions/${solutionId}`,
      body,
    );
    return response.data;
  }
}

class DeleteSolutionTool extends BaseTool {
  readonly name = 'delete_solution';
  readonly description =
    'Delete a solution from a problem. ' +
    'Use this when the user wants to remove their solution.';
  readonly parameters = z.object({
    problemId: z.string().describe('The unique ID of the problem'),
    solutionId: z.string().describe('The unique ID of the solution to delete'),
  });

  protected async run(args: { problemId: string; solutionId: string }, client: IApiClient) {
    const response = await client.delete(
      `/problems/${args.problemId}/solutions/${args.solutionId}`,
    );
    return response.data;
  }
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const problemTools: ITool[] = [
  // Problems
  new GetMyProblemsTool(),
  new GetProblemsTool(),
  new GetProblemTool(),
  new CreateProblemTool(),
  new UpdateProblemTool(),
  new DeleteProblemTool(),
  // Tags
  new GetAllTagsTool(),
  new AddTagToProblemTool(),
  new RemoveTagFromProblemTool(),
  // Testcases
  new CreateTestcaseTool(),
  new CreateTestcasesTool(),
  new GetTestcasesTool(),
  new GetSampleTestcasesTool(),
  new GetTestcaseTool(),
  new UpdateTestcaseTool(),
  new DeleteTestcaseTool(),
  // Hints
  new CreateHintTool(),
  new GetHintsTool(),
  new GetHintTool(),
  new UpdateHintTool(),
  new DeleteHintTool(),
  // Submissions
  new SubmitProblemTool(),
  new GetMySubmissionsTool(),
  new GetSubmissionTool(),
  // Solutions
  new CreateSolutionTool(),
  new GetSolutionsTool(),
  new GetMySolutionsTool(),
  new GetSolutionTool(),
  new UpdateSolutionTool(),
  new DeleteSolutionTool(),
];
