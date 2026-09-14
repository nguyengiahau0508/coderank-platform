import { z } from 'zod';
import { BaseTool } from '../base/base.tool';
import { IApiClient, ITool } from '../tool.interface';

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

const CoursePaginationSchema = z.object({
  page: z.number().optional().describe('Page number for pagination'),
  limit: z.number().optional().describe('Number of items per page'),
  search: z.string().optional().describe('Search keyword for course title'),
  sortBy: z
    .enum(['createdAt', 'title', 'enrollmentCount', 'rating'])
    .optional()
    .describe('Field to sort by'),
  sortOrder: z.enum(['asc', 'desc']).optional().describe('Sort direction'),
});

const EnrolledCoursePaginationSchema = z.object({
  page: z.number().optional().describe('Page number for pagination'),
  limit: z.number().optional().describe('Number of items per page'),
  search: z.string().optional().describe('Search keyword for course title'),
  level: z
    .enum(['beginner', 'intermediate', 'advanced'])
    .optional()
    .describe('Filter by course level'),
  status: z
    .enum(['active', 'completed', 'dropped'])
    .optional()
    .describe('Filter by enrollment status'),
  sortBy: z
    .enum(['enrolledAt', 'completedAt', 'progressPercent', 'lastAccessedAt', 'title'])
    .optional()
    .describe('Field to sort by'),
  sortOrder: z.enum(['ASC', 'DESC']).optional().describe('Sort direction'),
});

const CreateCourseSchema = z.object({
  title: z.string().describe('Course title'),
  slug: z.string().optional().describe('URL-friendly slug'),
  summary: z.string().optional().describe('Short summary (max 500 chars)'),
  description: z.string().optional().describe('Full description (HTML)'),
  thumbnailUrl: z.string().optional().describe('Thumbnail image URL'),
  level: z.enum(['beginner', 'intermediate', 'advanced']).optional().describe('Course level'),
  isPublic: z.boolean().optional().describe('Whether course is publicly accessible'),
  password: z.string().optional().describe('Password for private courses'),
  maxStudents: z.number().optional().describe('Maximum students (0 = unlimited)'),
  estimatedDurationMinutes: z.number().optional().describe('Estimated duration in minutes'),
  tags: z.string().optional().describe('Comma-separated tags'),
  category: z.string().optional().describe('Course category'),
  learningObjectives: z.string().optional().describe('Learning objectives (JSON array string)'),
  prerequisites: z.string().optional().describe('Prerequisites (JSON array string)'),
});

const UpdateCourseSchema = CreateCourseSchema.partial();

const CreateSectionSchema = z.object({
  title: z.string().describe('Section title'),
  description: z.string().optional().describe('Section description (HTML)'),
  sectionOrder: z.number().optional().describe('Display order'),
  isPublished: z.boolean().optional().describe('Whether published'),
});

const UpdateSectionSchema = CreateSectionSchema.partial();

const CreateLessonSchema = z.object({
  title: z.string().describe('Lesson title'),
  content: z.string().optional().describe('Lesson content (HTML)'),
  type: z.enum(['video', 'text', 'quiz', 'assignment']).optional().describe('Lesson type'),
  videoUrl: z.string().optional().describe('Video URL'),
  videoDurationSeconds: z.number().optional().describe('Video duration in seconds'),
  lessonOrder: z.number().optional().describe('Display order'),
  estimatedMinutes: z.number().optional().describe('Estimated time in minutes'),
  isPublished: z.boolean().optional().describe('Whether published'),
  isFreePreview: z.boolean().optional().describe('Free preview'),
});

const UpdateLessonSchema = CreateLessonSchema.partial();

const CreateLessonProblemSchema = z.object({
  problemId: z.string().describe('Problem UUID'),
  problemOrder: z.number().optional().describe('Display order'),
  isRequired: z.boolean().optional().describe('Whether required'),
  label: z.string().optional().describe('Custom label'),
});

const UpdateLessonProblemSchema = CreateLessonProblemSchema.partial().omit({ problemId: true });

const CreateQuizSchema = z.object({
  title: z.string().describe('Quiz title'),
  description: z.string().optional().describe('Quiz description/instructions (HTML)'),
  timeLimitMinutes: z.number().optional().describe('Time limit in minutes'),
  passingScore: z.number().optional().describe('Passing score percentage (0-100)'),
  maxAttempts: z.number().optional().describe('Max attempts (0 = unlimited)'),
  quizOrder: z.number().optional().describe('Display order'),
  shuffleQuestions: z.boolean().optional().describe('Shuffle questions'),
  showCorrectAnswers: z.boolean().optional().describe('Show correct answers after submission'),
  isPublished: z.boolean().optional().describe('Whether published'),
});

const UpdateQuizSchema = CreateQuizSchema.partial();

const QuizQuestionOptionSchema = z.object({
  text: z.string().describe('Option text'),
  isCorrect: z.boolean().optional().describe('Whether this is the correct answer'),
});

const CreateQuizQuestionSchema = z.object({
  questionText: z.string().describe('Question text (HTML)'),
  questionType: z
    .enum(['single_choice', 'multiple_choice', 'true_false', 'short_answer'])
    .optional()
    .describe('Question type'),
  options: z.array(QuizQuestionOptionSchema).optional().describe('Answer options'),
  correctAnswer: z.string().optional().describe('Correct answer'),
  explanation: z.string().optional().describe('Explanation (HTML)'),
  points: z.number().optional().describe('Points'),
  questionOrder: z.number().optional().describe('Display order'),
  imageUrl: z.string().optional().describe('Image URL'),
});

const UpdateQuizQuestionSchema = CreateQuizQuestionSchema.partial();

const SubmitQuizAttemptSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().describe('Question ID'),
        selectedOptionIndex: z.number().describe('Selected option index (0-based)'),
      }),
    )
    .describe('Array of answers'),
});

const CreateReviewSchema = z.object({
  rating: z.number().min(1).max(5).describe('Rating (1-5)'),
  comment: z.string().optional().describe('Review comment'),
});

const UpdateReviewSchema = CreateReviewSchema.partial();

const CreateAssignmentSchema = z.object({
  title: z.string().describe('Assignment title'),
  description: z.string().optional().describe('Assignment description/instructions (HTML)'),
  type: z.enum(['file_upload', 'text', 'link']).optional().describe('Assignment type'),
  maxScore: z.number().optional().describe('Maximum score'),
  dueDate: z.string().optional().describe('Due date (ISO string)'),
  assignmentOrder: z.number().optional().describe('Display order'),
  isPublished: z.boolean().optional().describe('Whether published'),
  allowedFileTypes: z.string().optional().describe('Allowed file extensions (comma-separated)'),
  maxFileSizeMb: z.number().optional().describe('Maximum file size in MB'),
});

const UpdateAssignmentSchema = CreateAssignmentSchema.partial();

const CreateSubmissionSchema = z.object({
  content: z.string().optional().describe('Text content or notes'),
});

const UpdateSubmissionSchema = CreateSubmissionSchema;

const GradeSubmissionSchema = z.object({
  score: z.number().optional().describe('Score'),
  feedback: z.string().optional().describe('Feedback (HTML)'),
  status: z.enum(['pending', 'submitted', 'graded', 'returned']).optional().describe('Status'),
});

// ═══════════════════════════════════════════════════════════════════════════════
// COURSE TOOLS
// ═══════════════════════════════════════════════════════════════════════════════

class CreateCourseTool extends BaseTool {
  readonly name = 'create_course';
  readonly description =
    'Create a new course. Use this when an instructor wants to create a new course.';
  readonly parameters = CreateCourseSchema;

  protected async run(args: z.infer<typeof CreateCourseSchema>, client: IApiClient) {
    const response = await client.post('/courses', args);
    return response.data;
  }
}

class GetCoursesTool extends BaseTool {
  readonly name = 'get_courses';
  readonly description =
    'Get a paginated list of all available courses. ' +
    'Use this when the user wants to browse or search the course catalog.';
  readonly parameters = CoursePaginationSchema;

  protected async run(args: z.infer<typeof CoursePaginationSchema>, client: IApiClient) {
    const response = await client.get('/courses', { params: args });
    return response.data;
  }
}

class GetMyCoursesTool extends BaseTool {
  readonly name = 'get_my_courses';
  readonly description =
    'Get a paginated list of courses created by the current user (instructor view). ' +
    'Use this when the user asks for "my courses", "courses I created", or "courses I teach".';
  readonly parameters = CoursePaginationSchema;

  protected async run(args: z.infer<typeof CoursePaginationSchema>, client: IApiClient) {
    const response = await client.get('/courses/me', { params: args });
    return response.data;
  }
}

class GetEnrolledCoursesTool extends BaseTool {
  readonly name = 'get_enrolled_courses';
  readonly description =
    'Get a paginated list of courses the current user is enrolled in (student view). ' +
    'Use this when the user asks for "courses I enrolled", "my enrolled courses", or "courses I am learning".';
  readonly parameters = EnrolledCoursePaginationSchema;

  protected async run(args: z.infer<typeof EnrolledCoursePaginationSchema>, client: IApiClient) {
    const response = await client.get('/courses/enrolled', { params: args });
    return response.data;
  }
}

class GetCourseTool extends BaseTool {
  readonly name = 'get_course';
  readonly description =
    'Get the full details of a single course by its ID. ' +
    'Use this when the user asks about a specific course.';
  readonly parameters = z.object({
    courseId: z.string().describe('The unique ID of the course'),
  });

  protected async run(args: { courseId: string }, client: IApiClient) {
    const response = await client.get(`/courses/${args.courseId}`);
    return response.data;
  }
}

class UpdateCourseTool extends BaseTool {
  readonly name = 'update_course';
  readonly description =
    'Update an existing course. Use this when an instructor wants to modify course details.';
  readonly parameters = z
    .object({
      courseId: z.string().describe('The unique ID of the course'),
    })
    .merge(UpdateCourseSchema);

  protected async run(
    args: { courseId: string } & z.infer<typeof UpdateCourseSchema>,
    client: IApiClient,
  ) {
    const { courseId, ...data } = args;
    const response = await client.patch(`/courses/${courseId}`, data);
    return response.data;
  }
}

class DeleteCourseTool extends BaseTool {
  readonly name = 'delete_course';
  readonly description = 'Delete a course. Use this when an instructor wants to remove a course.';
  readonly parameters = z.object({
    courseId: z.string().describe('The unique ID of the course'),
  });

  protected async run(args: { courseId: string }, client: IApiClient) {
    const response = await client.delete(`/courses/${args.courseId}`);
    return response.data;
  }
}

class DuplicateCourseTool extends BaseTool {
  readonly name = 'duplicate_course';
  readonly description =
    'Duplicate/clone an existing course. Use this when an instructor wants to copy a course.';
  readonly parameters = z.object({
    courseId: z.string().describe('The unique ID of the course to duplicate'),
    title: z.string().optional().describe('New title for the duplicated course'),
  });

  protected async run(args: { courseId: string; title?: string }, client: IApiClient) {
    const response = await client.post(`/courses/${args.courseId}/duplicate`, {
      title: args.title,
    });
    return response.data;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENROLLMENT TOOLS
// ═══════════════════════════════════════════════════════════════════════════════

class EnrollCourseTool extends BaseTool {
  readonly name = 'enroll_course';
  readonly description =
    'Enroll the current user in a course. ' +
    'Use this when the user wants to join or enroll in a course. ' +
    'If the course is private, a password is required.';
  readonly parameters = z.object({
    courseId: z.string().describe('The unique ID of the course'),
    password: z
      .string()
      .optional()
      .describe('Password for private courses (required if course is not public)'),
  });

  protected async run(args: { courseId: string; password?: string }, client: IApiClient) {
    const response = await client.post(`/courses/${args.courseId}/enroll`, {
      password: args.password,
    });
    return response.data;
  }
}

class UnenrollCourseTool extends BaseTool {
  readonly name = 'unenroll_course';
  readonly description =
    'Unenroll the current user from a course. ' +
    'Use this when the user wants to leave or unenroll from a course.';
  readonly parameters = z.object({
    courseId: z.string().describe('The unique ID of the course'),
  });

  protected async run(args: { courseId: string }, client: IApiClient) {
    const response = await client.delete(`/courses/${args.courseId}/enroll`);
    return response.data;
  }
}

class GetCourseEnrollmentsTool extends BaseTool {
  readonly name = 'get_course_enrollments';
  readonly description =
    'Get all enrollments for a course (instructor/admin view). ' +
    'Use this when an instructor wants to see who is enrolled in their course.';
  readonly parameters = z.object({
    courseId: z.string().describe('The unique ID of the course'),
  });

  protected async run(args: { courseId: string }, client: IApiClient) {
    const response = await client.get(`/courses/${args.courseId}/enrollments`);
    return response.data;
  }
}

class GetMyEnrollmentTool extends BaseTool {
  readonly name = 'get_my_enrollment';
  readonly description =
    "Get the current user's enrollment status for a specific course. " +
    'Use this when the user asks whether they are enrolled in a course.';
  readonly parameters = z.object({
    courseId: z.string().describe('The unique ID of the course'),
  });

  protected async run(args: { courseId: string }, client: IApiClient) {
    const response = await client.get(`/courses/${args.courseId}/enrollments/me`);
    return response.data;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION TOOLS
// ═══════════════════════════════════════════════════════════════════════════════

class CreateSectionTool extends BaseTool {
  readonly name = 'create_section';
  readonly description =
    'Create a new section in a course. Use this when adding a chapter or module to a course.';
  readonly parameters = z
    .object({
      courseId: z.string().describe('The unique ID of the course'),
    })
    .extend(CreateSectionSchema.shape);

  protected async run(
    args: { courseId: string } & z.infer<typeof CreateSectionSchema>,
    client: IApiClient,
  ) {
    const { courseId, ...data } = args;
    const response = await client.post(`/courses/${courseId}/sections`, data);
    return response.data;
  }
}

class GetCourseSectionsTool extends BaseTool {
  readonly name = 'get_course_sections';
  readonly description =
    'Get all sections of a course in order. ' +
    'Use this when the user wants to see the structure or outline of a course.';
  readonly parameters = z.object({
    courseId: z.string().describe('The unique ID of the course'),
  });

  protected async run(args: { courseId: string }, client: IApiClient) {
    const response = await client.get(`/courses/${args.courseId}/sections`);
    return response.data;
  }
}

class GetSectionTool extends BaseTool {
  readonly name = 'get_section';
  readonly description =
    'Get details of a specific section in a course. ' +
    'Use this when the user asks about a particular section.';
  readonly parameters = z.object({
    courseId: z.string().describe('The unique ID of the course'),
    sectionId: z.string().describe('The unique ID of the section'),
  });

  protected async run(args: { courseId: string; sectionId: string }, client: IApiClient) {
    const response = await client.get(`/courses/${args.courseId}/sections/${args.sectionId}`);
    return response.data;
  }
}

class UpdateSectionTool extends BaseTool {
  readonly name = 'update_section';
  readonly description = 'Update a section in a course. Use this to modify section details.';
  readonly parameters = z
    .object({
      courseId: z.string().describe('The unique ID of the course'),
      sectionId: z.string().describe('The unique ID of the section'),
    })
    .extend(UpdateSectionSchema.shape);

  protected async run(
    args: { courseId: string; sectionId: string } & z.infer<typeof UpdateSectionSchema>,
    client: IApiClient,
  ) {
    const { courseId, sectionId, ...data } = args;
    const response = await client.patch(`/courses/${courseId}/sections/${sectionId}`, data);
    return response.data;
  }
}

class DeleteSectionTool extends BaseTool {
  readonly name = 'delete_section';
  readonly description = 'Delete a section from a course.';
  readonly parameters = z.object({
    courseId: z.string().describe('The unique ID of the course'),
    sectionId: z.string().describe('The unique ID of the section'),
  });

  protected async run(args: { courseId: string; sectionId: string }, client: IApiClient) {
    const response = await client.delete(`/courses/${args.courseId}/sections/${args.sectionId}`);
    return response.data;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LESSON TOOLS
// ═══════════════════════════════════════════════════════════════════════════════

class CreateLessonTool extends BaseTool {
  readonly name = 'create_lesson';
  readonly description = 'Create a new lesson in a section. Use this when adding content to a course.';
  readonly parameters = z
    .object({
      courseId: z.string().describe('The unique ID of the course'),
      sectionId: z.string().describe('The unique ID of the section'),
    })
    .extend(CreateLessonSchema.shape);

  protected async run(
    args: { courseId: string; sectionId: string } & z.infer<typeof CreateLessonSchema>,
    client: IApiClient,
  ) {
    const { courseId, sectionId, ...data } = args;
    const response = await client.post(
      `/courses/${courseId}/sections/${sectionId}/lessons`,
      data,
    );
    return response.data;
  }
}

class GetSectionLessonsTool extends BaseTool {
  readonly name = 'get_section_lessons';
  readonly description =
    'Get all lessons in a specific section of a course. ' +
    'Use this when the user asks what lessons are in a section.';
  readonly parameters = z.object({
    courseId: z.string().describe('The unique ID of the course'),
    sectionId: z.string().describe('The unique ID of the section'),
  });

  protected async run(args: { courseId: string; sectionId: string }, client: IApiClient) {
    const response = await client.get(
      `/courses/${args.courseId}/sections/${args.sectionId}/lessons`,
    );
    return response.data;
  }
}

class GetLessonTool extends BaseTool {
  readonly name = 'get_lesson';
  readonly description =
    'Get the full content of a single lesson. ' +
    'Use this when the user asks about a specific lesson.';
  readonly parameters = z.object({
    courseId: z.string().describe('The unique ID of the course'),
    sectionId: z.string().describe('The unique ID of the section'),
    lessonId: z.string().describe('The unique ID of the lesson'),
  });

  protected async run(
    args: { courseId: string; sectionId: string; lessonId: string },
    client: IApiClient,
  ) {
    const response = await client.get(
      `/courses/${args.courseId}/sections/${args.sectionId}/lessons/${args.lessonId}`,
    );
    return response.data;
  }
}

class UpdateLessonTool extends BaseTool {
  readonly name = 'update_lesson';
  readonly description = 'Update a lesson in a course. Use this to modify lesson content.';
  readonly parameters = z
    .object({
      courseId: z.string().describe('The unique ID of the course'),
      sectionId: z.string().describe('The unique ID of the section'),
      lessonId: z.string().describe('The unique ID of the lesson'),
    })
    .extend(UpdateLessonSchema.shape);

  protected async run(
    args: { courseId: string; sectionId: string; lessonId: string } & z.infer<
      typeof UpdateLessonSchema
    >,
    client: IApiClient,
  ) {
    const { courseId, sectionId, lessonId, ...data } = args;
    const response = await client.patch(
      `/courses/${courseId}/sections/${sectionId}/lessons/${lessonId}`,
      data,
    );
    return response.data;
  }
}

class DeleteLessonTool extends BaseTool {
  readonly name = 'delete_lesson';
  readonly description = 'Delete a lesson from a course.';
  readonly parameters = z.object({
    courseId: z.string().describe('The unique ID of the course'),
    sectionId: z.string().describe('The unique ID of the section'),
    lessonId: z.string().describe('The unique ID of the lesson'),
  });

  protected async run(
    args: { courseId: string; sectionId: string; lessonId: string },
    client: IApiClient,
  ) {
    const response = await client.delete(
      `/courses/${args.courseId}/sections/${args.sectionId}/lessons/${args.lessonId}`,
    );
    return response.data;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LESSON PROBLEM TOOLS
// ═══════════════════════════════════════════════════════════════════════════════

class CreateLessonProblemTool extends BaseTool {
  readonly name = 'create_lesson_problem';
  readonly description = 'Attach a coding problem to a lesson.';
  readonly parameters = z
    .object({
      courseId: z.string().describe('The unique ID of the course'),
      sectionId: z.string().describe('The unique ID of the section'),
      lessonId: z.string().describe('The unique ID of the lesson'),
    })
    .extend(CreateLessonProblemSchema.shape);

  protected async run(
    args: { courseId: string; sectionId: string; lessonId: string } & z.infer<
      typeof CreateLessonProblemSchema
    >,
    client: IApiClient,
  ) {
    const { courseId, sectionId, lessonId, ...data } = args;
    const response = await client.post(
      `/courses/${courseId}/sections/${sectionId}/lessons/${lessonId}/problems`,
      data,
    );
    return response.data;
  }
}

class GetLessonProblemsTool extends BaseTool {
  readonly name = 'get_lesson_problems';
  readonly description =
    'Get all coding problems attached to a specific lesson. ' +
    'Use this when the user asks what problems are in a lesson.';
  readonly parameters = z.object({
    courseId: z.string().describe('The unique ID of the course'),
    sectionId: z.string().describe('The unique ID of the section'),
    lessonId: z.string().describe('The unique ID of the lesson'),
  });

  protected async run(
    args: { courseId: string; sectionId: string; lessonId: string },
    client: IApiClient,
  ) {
    const response = await client.get(
      `/courses/${args.courseId}/sections/${args.sectionId}/lessons/${args.lessonId}/problems`,
    );
    return response.data;
  }
}

class UpdateLessonProblemTool extends BaseTool {
  readonly name = 'update_lesson_problem';
  readonly description = 'Update a problem attachment in a lesson.';
  readonly parameters = z
    .object({
      courseId: z.string().describe('The unique ID of the course'),
      sectionId: z.string().describe('The unique ID of the section'),
      lessonId: z.string().describe('The unique ID of the lesson'),
      lessonProblemId: z.string().describe('The unique ID of the lesson-problem link'),
    })
    .extend(UpdateLessonProblemSchema.shape);

  protected async run(
    args: {
      courseId: string;
      sectionId: string;
      lessonId: string;
      lessonProblemId: string;
    } & z.infer<typeof UpdateLessonProblemSchema>,
    client: IApiClient,
  ) {
    const { courseId, sectionId, lessonId, lessonProblemId, ...data } = args;
    const response = await client.patch(
      `/courses/${courseId}/sections/${sectionId}/lessons/${lessonId}/problems/${lessonProblemId}`,
      data,
    );
    return response.data;
  }
}

class DeleteLessonProblemTool extends BaseTool {
  readonly name = 'delete_lesson_problem';
  readonly description = 'Remove a problem from a lesson.';
  readonly parameters = z.object({
    courseId: z.string().describe('The unique ID of the course'),
    sectionId: z.string().describe('The unique ID of the section'),
    lessonId: z.string().describe('The unique ID of the lesson'),
    lessonProblemId: z.string().describe('The unique ID of the lesson-problem link'),
  });

  protected async run(
    args: { courseId: string; sectionId: string; lessonId: string; lessonProblemId: string },
    client: IApiClient,
  ) {
    const response = await client.delete(
      `/courses/${args.courseId}/sections/${args.sectionId}/lessons/${args.lessonId}/problems/${args.lessonProblemId}`,
    );
    return response.data;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LESSON PROGRESS TOOL
// ═══════════════════════════════════════════════════════════════════════════════

class MarkLessonCompleteTool extends BaseTool {
  readonly name = 'mark_lesson_complete';
  readonly description =
    'Mark a lesson as completed for the current user. ' +
    'Use this when the user wants to mark a lesson as done.';
  readonly parameters = z.object({
    courseId: z.string().describe('The unique ID of the course'),
    sectionId: z.string().describe('The unique ID of the section'),
    lessonId: z.string().describe('The unique ID of the lesson'),
  });

  protected async run(
    args: { courseId: string; sectionId: string; lessonId: string },
    client: IApiClient,
  ) {
    const response = await client.post(
      `/courses/${args.courseId}/sections/${args.sectionId}/lessons/${args.lessonId}/progress`,
    );
    return response.data;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUIZ TOOLS
// ═══════════════════════════════════════════════════════════════════════════════

class CreateQuizTool extends BaseTool {
  readonly name = 'create_quiz';
  readonly description = 'Create a new quiz in a lesson.';
  readonly parameters = z
    .object({
      courseId: z.string().describe('The unique ID of the course'),
      sectionId: z.string().describe('The unique ID of the section'),
      lessonId: z.string().describe('The unique ID of the lesson'),
    })
    .extend(CreateQuizSchema.shape);

  protected async run(
    args: { courseId: string; sectionId: string; lessonId: string } & z.infer<
      typeof CreateQuizSchema
    >,
    client: IApiClient,
  ) {
    const { courseId, sectionId, lessonId, ...data } = args;
    const response = await client.post(
      `/courses/${courseId}/sections/${sectionId}/lessons/${lessonId}/quizzes`,
      data,
    );
    return response.data;
  }
}

class GetLessonQuizzesTool extends BaseTool {
  readonly name = 'get_lesson_quizzes';
  readonly description =
    'Get all quizzes in a specific lesson. ' +
    'Use this when the user asks what quizzes are in a lesson.';
  readonly parameters = z.object({
    courseId: z.string().describe('The unique ID of the course'),
    sectionId: z.string().describe('The unique ID of the section'),
    lessonId: z.string().describe('The unique ID of the lesson'),
  });

  protected async run(
    args: { courseId: string; sectionId: string; lessonId: string },
    client: IApiClient,
  ) {
    const response = await client.get(
      `/courses/${args.courseId}/sections/${args.sectionId}/lessons/${args.lessonId}/quizzes`,
    );
    return response.data;
  }
}

class GetQuizTool extends BaseTool {
  readonly name = 'get_quiz';
  readonly description =
    'Get details of a specific quiz including its questions. ' +
    'Use this when the user asks about a particular quiz.';
  readonly parameters = z.object({
    courseId: z.string().describe('The unique ID of the course'),
    sectionId: z.string().describe('The unique ID of the section'),
    lessonId: z.string().describe('The unique ID of the lesson'),
    quizId: z.string().describe('The unique ID of the quiz'),
  });

  protected async run(
    args: { courseId: string; sectionId: string; lessonId: string; quizId: string },
    client: IApiClient,
  ) {
    const response = await client.get(
      `/courses/${args.courseId}/sections/${args.sectionId}/lessons/${args.lessonId}/quizzes/${args.quizId}`,
    );
    return response.data;
  }
}

class UpdateQuizTool extends BaseTool {
  readonly name = 'update_quiz';
  readonly description = 'Update a quiz in a lesson.';
  readonly parameters = z
    .object({
      courseId: z.string().describe('The unique ID of the course'),
      sectionId: z.string().describe('The unique ID of the section'),
      lessonId: z.string().describe('The unique ID of the lesson'),
      quizId: z.string().describe('The unique ID of the quiz'),
    })
    .extend(UpdateQuizSchema.shape);

  protected async run(
    args: { courseId: string; sectionId: string; lessonId: string; quizId: string } & z.infer<
      typeof UpdateQuizSchema
    >,
    client: IApiClient,
  ) {
    const { courseId, sectionId, lessonId, quizId, ...data } = args;
    const response = await client.patch(
      `/courses/${courseId}/sections/${sectionId}/lessons/${lessonId}/quizzes/${quizId}`,
      data,
    );
    return response.data;
  }
}

class DeleteQuizTool extends BaseTool {
  readonly name = 'delete_quiz';
  readonly description = 'Delete a quiz from a lesson.';
  readonly parameters = z.object({
    courseId: z.string().describe('The unique ID of the course'),
    sectionId: z.string().describe('The unique ID of the section'),
    lessonId: z.string().describe('The unique ID of the lesson'),
    quizId: z.string().describe('The unique ID of the quiz'),
  });

  protected async run(
    args: { courseId: string; sectionId: string; lessonId: string; quizId: string },
    client: IApiClient,
  ) {
    const response = await client.delete(
      `/courses/${args.courseId}/sections/${args.sectionId}/lessons/${args.lessonId}/quizzes/${args.quizId}`,
    );
    return response.data;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUIZ QUESTION TOOLS
// ═══════════════════════════════════════════════════════════════════════════════

class CreateQuizQuestionTool extends BaseTool {
  readonly name = 'create_quiz_question';
  readonly description = 'Create a new question in a quiz.';
  readonly parameters = z
    .object({
      courseId: z.string().describe('The unique ID of the course'),
      sectionId: z.string().describe('The unique ID of the section'),
      lessonId: z.string().describe('The unique ID of the lesson'),
      quizId: z.string().describe('The unique ID of the quiz'),
    })
    .extend(CreateQuizQuestionSchema.shape);

  protected async run(
    args: { courseId: string; sectionId: string; lessonId: string; quizId: string } & z.infer<
      typeof CreateQuizQuestionSchema
    >,
    client: IApiClient,
  ) {
    const { courseId, sectionId, lessonId, quizId, ...data } = args;
    const response = await client.post(
      `/courses/${courseId}/sections/${sectionId}/lessons/${lessonId}/quizzes/${quizId}/questions`,
      data,
    );
    return response.data;
  }
}

class GetQuizQuestionsTool extends BaseTool {
  readonly name = 'get_quiz_questions';
  readonly description =
    'Get all questions in a specific quiz. ' +
    'Use this when the user wants to see the questions in a quiz.';
  readonly parameters = z.object({
    courseId: z.string().describe('The unique ID of the course'),
    sectionId: z.string().describe('The unique ID of the section'),
    lessonId: z.string().describe('The unique ID of the lesson'),
    quizId: z.string().describe('The unique ID of the quiz'),
  });

  protected async run(
    args: { courseId: string; sectionId: string; lessonId: string; quizId: string },
    client: IApiClient,
  ) {
    const response = await client.get(
      `/courses/${args.courseId}/sections/${args.sectionId}/lessons/${args.lessonId}/quizzes/${args.quizId}/questions`,
    );
    return response.data;
  }
}

class GetQuizQuestionTool extends BaseTool {
  readonly name = 'get_quiz_question';
  readonly description = 'Get details of a specific quiz question.';
  readonly parameters = z.object({
    courseId: z.string().describe('The unique ID of the course'),
    sectionId: z.string().describe('The unique ID of the section'),
    lessonId: z.string().describe('The unique ID of the lesson'),
    quizId: z.string().describe('The unique ID of the quiz'),
    questionId: z.string().describe('The unique ID of the question'),
  });

  protected async run(
    args: {
      courseId: string;
      sectionId: string;
      lessonId: string;
      quizId: string;
      questionId: string;
    },
    client: IApiClient,
  ) {
    const response = await client.get(
      `/courses/${args.courseId}/sections/${args.sectionId}/lessons/${args.lessonId}/quizzes/${args.quizId}/questions/${args.questionId}`,
    );
    return response.data;
  }
}

class UpdateQuizQuestionTool extends BaseTool {
  readonly name = 'update_quiz_question';
  readonly description = 'Update a question in a quiz.';
  readonly parameters = z
    .object({
      courseId: z.string().describe('The unique ID of the course'),
      sectionId: z.string().describe('The unique ID of the section'),
      lessonId: z.string().describe('The unique ID of the lesson'),
      quizId: z.string().describe('The unique ID of the quiz'),
      questionId: z.string().describe('The unique ID of the question'),
    })
    .extend(UpdateQuizQuestionSchema.shape);

  protected async run(
    args: {
      courseId: string;
      sectionId: string;
      lessonId: string;
      quizId: string;
      questionId: string;
    } & z.infer<typeof UpdateQuizQuestionSchema>,
    client: IApiClient,
  ) {
    const { courseId, sectionId, lessonId, quizId, questionId, ...data } = args;
    const response = await client.patch(
      `/courses/${courseId}/sections/${sectionId}/lessons/${lessonId}/quizzes/${quizId}/questions/${questionId}`,
      data,
    );
    return response.data;
  }
}

class DeleteQuizQuestionTool extends BaseTool {
  readonly name = 'delete_quiz_question';
  readonly description = 'Delete a question from a quiz.';
  readonly parameters = z.object({
    courseId: z.string().describe('The unique ID of the course'),
    sectionId: z.string().describe('The unique ID of the section'),
    lessonId: z.string().describe('The unique ID of the lesson'),
    quizId: z.string().describe('The unique ID of the quiz'),
    questionId: z.string().describe('The unique ID of the question'),
  });

  protected async run(
    args: {
      courseId: string;
      sectionId: string;
      lessonId: string;
      quizId: string;
      questionId: string;
    },
    client: IApiClient,
  ) {
    const response = await client.delete(
      `/courses/${args.courseId}/sections/${args.sectionId}/lessons/${args.lessonId}/quizzes/${args.quizId}/questions/${args.questionId}`,
    );
    return response.data;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUIZ ATTEMPT TOOLS
// ═══════════════════════════════════════════════════════════════════════════════

class SubmitQuizAttemptTool extends BaseTool {
  readonly name = 'submit_quiz_attempt';
  readonly description =
    'Submit answers for a quiz attempt. ' +
    'Use this when the user wants to submit their quiz answers.';
  readonly parameters = z
    .object({
      courseId: z.string().describe('The unique ID of the course'),
      sectionId: z.string().describe('The unique ID of the section'),
      lessonId: z.string().describe('The unique ID of the lesson'),
      quizId: z.string().describe('The unique ID of the quiz'),
    })
    .extend(SubmitQuizAttemptSchema.shape);

  protected async run(
    args: { courseId: string; sectionId: string; lessonId: string; quizId: string } & z.infer<
      typeof SubmitQuizAttemptSchema
    >,
    client: IApiClient,
  ) {
    const { courseId, sectionId, lessonId, quizId, answers } = args;
    const response = await client.post(
      `/courses/${courseId}/sections/${sectionId}/lessons/${lessonId}/quizzes/${quizId}/attempts`,
      { answers },
    );
    return response.data;
  }
}

class GetMyQuizAttemptsTool extends BaseTool {
  readonly name = 'get_my_quiz_attempts';
  readonly description =
    'Get all quiz attempts by the current user for a specific quiz. ' +
    'Use this when the user asks about their quiz history or scores.';
  readonly parameters = z.object({
    courseId: z.string().describe('The unique ID of the course'),
    sectionId: z.string().describe('The unique ID of the section'),
    lessonId: z.string().describe('The unique ID of the lesson'),
    quizId: z.string().describe('The unique ID of the quiz'),
  });

  protected async run(
    args: { courseId: string; sectionId: string; lessonId: string; quizId: string },
    client: IApiClient,
  ) {
    const response = await client.get(
      `/courses/${args.courseId}/sections/${args.sectionId}/lessons/${args.lessonId}/quizzes/${args.quizId}/attempts`,
    );
    return response.data;
  }
}

class GetQuizAttemptTool extends BaseTool {
  readonly name = 'get_quiz_attempt';
  readonly description = 'Get details of a specific quiz attempt.';
  readonly parameters = z.object({
    courseId: z.string().describe('The unique ID of the course'),
    sectionId: z.string().describe('The unique ID of the section'),
    lessonId: z.string().describe('The unique ID of the lesson'),
    quizId: z.string().describe('The unique ID of the quiz'),
    attemptId: z.string().describe('The unique ID of the attempt'),
  });

  protected async run(
    args: {
      courseId: string;
      sectionId: string;
      lessonId: string;
      quizId: string;
      attemptId: string;
    },
    client: IApiClient,
  ) {
    const response = await client.get(
      `/courses/${args.courseId}/sections/${args.sectionId}/lessons/${args.lessonId}/quizzes/${args.quizId}/attempts/${args.attemptId}`,
    );
    return response.data;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROGRESS TOOL
// ═══════════════════════════════════════════════════════════════════════════════

class GetCourseProgressTool extends BaseTool {
  readonly name = 'get_course_progress';
  readonly description =
    "Get the current user's lesson completion progress for an enrolled course. " +
    'Use this when the user asks how far along they are in a course.';
  readonly parameters = z.object({
    courseId: z.string().describe('The unique ID of the course'),
  });

  protected async run(args: { courseId: string }, client: IApiClient) {
    const response = await client.get(`/courses/${args.courseId}/progress`);
    return response.data;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// REVIEW TOOLS
// ═══════════════════════════════════════════════════════════════════════════════

class CreateCourseReviewTool extends BaseTool {
  readonly name = 'create_course_review';
  readonly description =
    'Submit a review and rating for a course. ' +
    'Use this when the user wants to rate or review a course.';
  readonly parameters = z
    .object({
      courseId: z.string().describe('The unique ID of the course'),
    })
    .extend(CreateReviewSchema.shape);

  protected async run(
    args: { courseId: string } & z.infer<typeof CreateReviewSchema>,
    client: IApiClient,
  ) {
    const { courseId, ...data } = args;
    const response = await client.post(`/courses/${courseId}/reviews`, data);
    return response.data;
  }
}

class GetCourseReviewsTool extends BaseTool {
  readonly name = 'get_course_reviews';
  readonly description =
    'Get all reviews and ratings submitted for a course. ' +
    'Use this when the user wants to see feedback or the rating of a course.';
  readonly parameters = z.object({
    courseId: z.string().describe('The unique ID of the course'),
  });

  protected async run(args: { courseId: string }, client: IApiClient) {
    const response = await client.get(`/courses/${args.courseId}/reviews`);
    return response.data;
  }
}

class UpdateCourseReviewTool extends BaseTool {
  readonly name = 'update_course_review';
  readonly description = 'Update a review for a course.';
  readonly parameters = z
    .object({
      courseId: z.string().describe('The unique ID of the course'),
      reviewId: z.string().describe('The unique ID of the review'),
    })
    .extend(UpdateReviewSchema.shape);

  protected async run(
    args: { courseId: string; reviewId: string } & z.infer<typeof UpdateReviewSchema>,
    client: IApiClient,
  ) {
    const { courseId, reviewId, ...data } = args;
    const response = await client.patch(`/courses/${courseId}/reviews/${reviewId}`, data);
    return response.data;
  }
}

class DeleteCourseReviewTool extends BaseTool {
  readonly name = 'delete_course_review';
  readonly description = 'Delete a review from a course.';
  readonly parameters = z.object({
    courseId: z.string().describe('The unique ID of the course'),
    reviewId: z.string().describe('The unique ID of the review'),
  });

  protected async run(args: { courseId: string; reviewId: string }, client: IApiClient) {
    const response = await client.delete(`/courses/${args.courseId}/reviews/${args.reviewId}`);
    return response.data;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ASSIGNMENT TOOLS
// ═══════════════════════════════════════════════════════════════════════════════

class CreateAssignmentTool extends BaseTool {
  readonly name = 'create_assignment';
  readonly description = 'Create a new assignment in a lesson.';
  readonly parameters = z
    .object({
      courseId: z.string().describe('The unique ID of the course'),
      lessonId: z.string().describe('The unique ID of the lesson'),
    })
    .extend(CreateAssignmentSchema.shape);

  protected async run(
    args: { courseId: string; lessonId: string } & z.infer<typeof CreateAssignmentSchema>,
    client: IApiClient,
  ) {
    const { courseId, lessonId, ...data } = args;
    const response = await client.post(
      `/courses/${courseId}/lessons/${lessonId}/assignments`,
      data,
    );
    return response.data;
  }
}

class GetLessonAssignmentsTool extends BaseTool {
  readonly name = 'get_lesson_assignments';
  readonly description =
    'Get all assignments in a specific lesson. ' +
    'Use this when the user asks what assignments are in a lesson.';
  readonly parameters = z.object({
    courseId: z.string().describe('The unique ID of the course'),
    lessonId: z.string().describe('The unique ID of the lesson'),
  });

  protected async run(args: { courseId: string; lessonId: string }, client: IApiClient) {
    const response = await client.get(
      `/courses/${args.courseId}/lessons/${args.lessonId}/assignments`,
    );
    return response.data;
  }
}

class GetAssignmentTool extends BaseTool {
  readonly name = 'get_assignment';
  readonly description =
    'Get details of a specific assignment. ' +
    'Use this when the user asks about a particular assignment.';
  readonly parameters = z.object({
    courseId: z.string().describe('The unique ID of the course'),
    lessonId: z.string().describe('The unique ID of the lesson'),
    assignmentId: z.string().describe('The unique ID of the assignment'),
  });

  protected async run(
    args: { courseId: string; lessonId: string; assignmentId: string },
    client: IApiClient,
  ) {
    const response = await client.get(
      `/courses/${args.courseId}/lessons/${args.lessonId}/assignments/${args.assignmentId}`,
    );
    return response.data;
  }
}

class UpdateAssignmentTool extends BaseTool {
  readonly name = 'update_assignment';
  readonly description = 'Update an assignment in a lesson.';
  readonly parameters = z
    .object({
      courseId: z.string().describe('The unique ID of the course'),
      lessonId: z.string().describe('The unique ID of the lesson'),
      assignmentId: z.string().describe('The unique ID of the assignment'),
    })
    .extend(UpdateAssignmentSchema.shape);

  protected async run(
    args: { courseId: string; lessonId: string; assignmentId: string } & z.infer<
      typeof UpdateAssignmentSchema
    >,
    client: IApiClient,
  ) {
    const { courseId, lessonId, assignmentId, ...data } = args;
    const response = await client.patch(
      `/courses/${courseId}/lessons/${lessonId}/assignments/${assignmentId}`,
      data,
    );
    return response.data;
  }
}

class DeleteAssignmentTool extends BaseTool {
  readonly name = 'delete_assignment';
  readonly description = 'Delete an assignment from a lesson.';
  readonly parameters = z.object({
    courseId: z.string().describe('The unique ID of the course'),
    lessonId: z.string().describe('The unique ID of the lesson'),
    assignmentId: z.string().describe('The unique ID of the assignment'),
  });

  protected async run(
    args: { courseId: string; lessonId: string; assignmentId: string },
    client: IApiClient,
  ) {
    const response = await client.delete(
      `/courses/${args.courseId}/lessons/${args.lessonId}/assignments/${args.assignmentId}`,
    );
    return response.data;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ASSIGNMENT SUBMISSION TOOLS
// ═══════════════════════════════════════════════════════════════════════════════

class CreateAssignmentSubmissionTool extends BaseTool {
  readonly name = 'create_assignment_submission';
  readonly description =
    'Submit an assignment. ' +
    'Use this when the user wants to submit their work for an assignment.';
  readonly parameters = z
    .object({
      courseId: z.string().describe('The unique ID of the course'),
      lessonId: z.string().describe('The unique ID of the lesson'),
      assignmentId: z.string().describe('The unique ID of the assignment'),
    })
    .extend(CreateSubmissionSchema.shape);

  protected async run(
    args: { courseId: string; lessonId: string; assignmentId: string } & z.infer<
      typeof CreateSubmissionSchema
    >,
    client: IApiClient,
  ) {
    const { courseId, lessonId, assignmentId, ...data } = args;
    const response = await client.post(
      `/courses/${courseId}/lessons/${lessonId}/assignments/${assignmentId}/submissions`,
      data,
    );
    return response.data;
  }
}

class GetAssignmentSubmissionsTool extends BaseTool {
  readonly name = 'get_assignment_submissions';
  readonly description =
    'Get all submissions for an assignment (instructor view). ' +
    'Use this when an instructor wants to see all submissions.';
  readonly parameters = z.object({
    courseId: z.string().describe('The unique ID of the course'),
    lessonId: z.string().describe('The unique ID of the lesson'),
    assignmentId: z.string().describe('The unique ID of the assignment'),
  });

  protected async run(
    args: { courseId: string; lessonId: string; assignmentId: string },
    client: IApiClient,
  ) {
    const response = await client.get(
      `/courses/${args.courseId}/lessons/${args.lessonId}/assignments/${args.assignmentId}/submissions`,
    );
    return response.data;
  }
}

class GetMyAssignmentSubmissionTool extends BaseTool {
  readonly name = 'get_my_assignment_submission';
  readonly description =
    "Get the current user's submission for an assignment. " +
    'Use this when the user asks about their submission.';
  readonly parameters = z.object({
    courseId: z.string().describe('The unique ID of the course'),
    lessonId: z.string().describe('The unique ID of the lesson'),
    assignmentId: z.string().describe('The unique ID of the assignment'),
  });

  protected async run(
    args: { courseId: string; lessonId: string; assignmentId: string },
    client: IApiClient,
  ) {
    const response = await client.get(
      `/courses/${args.courseId}/lessons/${args.lessonId}/assignments/${args.assignmentId}/submissions/me`,
    );
    return response.data;
  }
}

class UpdateAssignmentSubmissionTool extends BaseTool {
  readonly name = 'update_assignment_submission';
  readonly description = 'Update an assignment submission.';
  readonly parameters = z
    .object({
      courseId: z.string().describe('The unique ID of the course'),
      lessonId: z.string().describe('The unique ID of the lesson'),
      assignmentId: z.string().describe('The unique ID of the assignment'),
      submissionId: z.string().describe('The unique ID of the submission'),
    })
    .extend(UpdateSubmissionSchema.shape);

  protected async run(
    args: {
      courseId: string;
      lessonId: string;
      assignmentId: string;
      submissionId: string;
    } & z.infer<typeof UpdateSubmissionSchema>,
    client: IApiClient,
  ) {
    const { courseId, lessonId, assignmentId, submissionId, ...data } = args;
    const response = await client.patch(
      `/courses/${courseId}/lessons/${lessonId}/assignments/${assignmentId}/submissions/${submissionId}`,
      data,
    );
    return response.data;
  }
}

class DeleteAssignmentSubmissionTool extends BaseTool {
  readonly name = 'delete_assignment_submission';
  readonly description = 'Delete an assignment submission.';
  readonly parameters = z.object({
    courseId: z.string().describe('The unique ID of the course'),
    lessonId: z.string().describe('The unique ID of the lesson'),
    assignmentId: z.string().describe('The unique ID of the assignment'),
    submissionId: z.string().describe('The unique ID of the submission'),
  });

  protected async run(
    args: { courseId: string; lessonId: string; assignmentId: string; submissionId: string },
    client: IApiClient,
  ) {
    const response = await client.delete(
      `/courses/${args.courseId}/lessons/${args.lessonId}/assignments/${args.assignmentId}/submissions/${args.submissionId}`,
    );
    return response.data;
  }
}

class DownloadAssignmentSubmissionTool extends BaseTool {
  readonly name = 'download_assignment_submission';
  readonly description = 'Get download URL for an assignment submission file.';
  readonly parameters = z.object({
    courseId: z.string().describe('The unique ID of the course'),
    lessonId: z.string().describe('The unique ID of the lesson'),
    assignmentId: z.string().describe('The unique ID of the assignment'),
    submissionId: z.string().describe('The unique ID of the submission'),
  });

  protected async run(
    args: { courseId: string; lessonId: string; assignmentId: string; submissionId: string },
    client: IApiClient,
  ) {
    const response = await client.get(
      `/courses/${args.courseId}/lessons/${args.lessonId}/assignments/${args.assignmentId}/submissions/${args.submissionId}/download`,
    );
    return response.data;
  }
}

class GradeAssignmentSubmissionTool extends BaseTool {
  readonly name = 'grade_assignment_submission';
  readonly description =
    'Grade an assignment submission (instructor view). ' +
    'Use this when an instructor wants to grade a student submission.';
  readonly parameters = z
    .object({
      courseId: z.string().describe('The unique ID of the course'),
      lessonId: z.string().describe('The unique ID of the lesson'),
      assignmentId: z.string().describe('The unique ID of the assignment'),
      submissionId: z.string().describe('The unique ID of the submission'),
    })
    .extend(GradeSubmissionSchema.shape);

  protected async run(
    args: {
      courseId: string;
      lessonId: string;
      assignmentId: string;
      submissionId: string;
    } & z.infer<typeof GradeSubmissionSchema>,
    client: IApiClient,
  ) {
    const { courseId, lessonId, assignmentId, submissionId, ...data } = args;
    const response = await client.patch(
      `/courses/${courseId}/lessons/${lessonId}/assignments/${assignmentId}/submissions/${submissionId}/grade`,
      data,
    );
    return response.data;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT ALL TOOLS
// ═══════════════════════════════════════════════════════════════════════════════

export const courseTools: ITool[] = [
  // Courses (8)
  new CreateCourseTool(),
  new GetCoursesTool(),
  new GetMyCoursesTool(),
  new GetEnrolledCoursesTool(),
  new GetCourseTool(),
  new UpdateCourseTool(),
  new DeleteCourseTool(),
  new DuplicateCourseTool(),
  // Enrollments (4)
  new EnrollCourseTool(),
  new UnenrollCourseTool(),
  new GetCourseEnrollmentsTool(),
  new GetMyEnrollmentTool(),
  // Sections (5)
  new CreateSectionTool(),
  new GetCourseSectionsTool(),
  new GetSectionTool(),
  new UpdateSectionTool(),
  new DeleteSectionTool(),
  // Lessons (5)
  new CreateLessonTool(),
  new GetSectionLessonsTool(),
  new GetLessonTool(),
  new UpdateLessonTool(),
  new DeleteLessonTool(),
  // Lesson Problems (4)
  new CreateLessonProblemTool(),
  new GetLessonProblemsTool(),
  new UpdateLessonProblemTool(),
  new DeleteLessonProblemTool(),
  // Lesson Progress (1)
  new MarkLessonCompleteTool(),
  // Quizzes (5)
  new CreateQuizTool(),
  new GetLessonQuizzesTool(),
  new GetQuizTool(),
  new UpdateQuizTool(),
  new DeleteQuizTool(),
  // Quiz Questions (5)
  new CreateQuizQuestionTool(),
  new GetQuizQuestionsTool(),
  new GetQuizQuestionTool(),
  new UpdateQuizQuestionTool(),
  new DeleteQuizQuestionTool(),
  // Quiz Attempts (3)
  new SubmitQuizAttemptTool(),
  new GetMyQuizAttemptsTool(),
  new GetQuizAttemptTool(),
  // Progress (1)
  new GetCourseProgressTool(),
  // Reviews (4)
  new CreateCourseReviewTool(),
  new GetCourseReviewsTool(),
  new UpdateCourseReviewTool(),
  new DeleteCourseReviewTool(),
  // Assignments (5)
  new CreateAssignmentTool(),
  new GetLessonAssignmentsTool(),
  new GetAssignmentTool(),
  new UpdateAssignmentTool(),
  new DeleteAssignmentTool(),
  // Assignment Submissions (7)
  new CreateAssignmentSubmissionTool(),
  new GetAssignmentSubmissionsTool(),
  new GetMyAssignmentSubmissionTool(),
  new UpdateAssignmentSubmissionTool(),
  new DeleteAssignmentSubmissionTool(),
  new DownloadAssignmentSubmissionTool(),
  new GradeAssignmentSubmissionTool(),
];
