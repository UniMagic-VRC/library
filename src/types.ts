export type Page = "home" | "course" | "lesson" | "search";

export type Term = {
  id: string;
  label: string;
  startsAt: string;
};

export type Course = {
  id: string;
  title: string;
  description?: string;
  tags?: string[];
};

export type LessonFile = {
  name: string;
  path: string;
  size: number;
};

export type Lesson = {
  id: string;
  termId: string;
  courseId: string;
  lessonNo: string;
  title: string;
  description: string;
  date: string | null;
  tags: string[];
  lastUpdated?: string;
  isLatestForCourseLesson: boolean;
  files: LessonFile[];
};

export type SearchView = {
  label: string;
  tags?: string[];
};

export type Catalog = {
  generatedAt: string;
  terms: Term[];
  courses: Course[];
  lessons: Lesson[];
  searchViews?: SearchView[];
};
