import { sourceDescriptorSchema, SourceError } from "../../data-sources/source.ts";
import type {
  AnalysisRequest,
  AnalysisResult,
  DataSource,
  ResultTable,
} from "../../data-sources/source.ts";

export const educationPeriod = { start: "2025-03-01", end: "2025-04-01" };
const students = [
  { studentId: 1, day: "2025-03-01", schoolId: 10, campus: "North", course: "Math", passed: true },
  { studentId: 2, day: "2025-03-01", schoolId: 10, campus: "North", course: "Math", passed: false },
  {
    studentId: 3,
    day: "2025-03-02",
    schoolId: 20,
    campus: "South",
    course: "History",
    passed: true,
  },
  { studentId: 4, day: "2025-03-02", schoolId: 20, campus: "South", course: "Math", passed: true },
  {
    studentId: 5,
    day: "2025-03-03",
    schoolId: 10,
    campus: "North",
    course: "History",
    passed: true,
  },
  { studentId: 6, day: "2025-03-03", schoolId: 10, campus: "North", course: "Math", passed: false },
];
export class EducationSource implements DataSource {
  describe() {
    return sourceDescriptorSchema.parse({
      id: "education",
      title: "School learning data",
      version: "1",
      datasetVersion: "1",
      metricVersion: "1",
      coverage: educationPeriod,
      asOf: "2025-03-31",
      metadata: { synthetic: true },
      instructions:
        "Students are distinct enrollments. Use teachingDay for daily trends, course for course rankings, and courseCampus for a course-by-campus matrix. Completion is the percentage of enrolled students who passed.",
      capabilities: ["enrollments", "completion", "projectedEnrollment"].map((metric) => ({
        metric,
        description:
          metric === "completion"
            ? "Passed students divided by enrolled students."
            : "Number of enrolled students.",
        presentation: {
          label:
            metric === "completion"
              ? "Course completion"
              : metric === "projectedEnrollment"
                ? "Projected enrollment"
                : "Student enrollment",
          ...(metric === "projectedEnrollment" ? { scenario: true } : {}),
        },
        unit: metric === "completion" ? "percent" : "students",
        calculation: metric === "completion" ? "percentage" : "total",
        fields: ["period", "filters", "groupBy", ...(metric === "enrollments" ? ["records"] : [])],
        filters: ["campus", "schoolId", "passed", "course"],
        filterControls: [
          {
            field: "campus",
            label: "Campus",
            type: "string",
            options: ["North", "South"].map((value) => ({ value, label: value })),
          },
          {
            field: "schoolId",
            label: "School",
            type: "number",
            options: [
              { value: 10, label: "Primary" },
              { value: 20, label: "Secondary" },
            ],
          },
          { field: "passed", label: "Passed", type: "boolean" },
          { field: "course", label: "Course", type: "string" },
        ],
        groupings: [
          { field: "teachingDay", kind: "series", interval: "day" },
          { field: "course", kind: "ranked", drillFilter: "course" },
          { field: "schoolId", kind: "ranked", drillFilter: "schoolId" },
          { field: "courseCampus", kind: "matrix" },
        ],
      })),
      examples: [
        {
          title: "Show daily student enrollment",
          request: { metric: "enrollments", period: educationPeriod, groupBy: "teachingDay" },
        },
      ],
    });
  }
  async execute(request: AnalysisRequest): Promise<AnalysisResult> {
    const descriptor = this.describe();
    const capability = descriptor.capabilities.find((item) => item.metric === request.metric);
    if (!capability) throw new SourceError("unsupported", "Unknown education metric.");
    const rows = students.filter(
      (student) =>
        (!request.period ||
          (student.day >= request.period.start && student.day < request.period.end)) &&
        Object.entries(request.filters ?? {}).every(
          ([field, value]) => Reflect.get(student, field) === value,
        ),
    );
    const numerator =
      request.metric === "completion" ? rows.filter((row) => row.passed).length : rows.length;
    const denominator = request.metric === "completion" ? rows.length : null;
    const value =
      denominator === 0 ? null : denominator === null ? numerator : (numerator / denominator) * 100;
    let table: ResultTable | undefined;
    if (request.records)
      table = {
        kind: "records",
        omitted: 0,
        columns: [
          { key: "studentId", label: "Student", type: "id" },
          { key: "course", label: "Course", type: "category" },
          { key: "value", label: "Enrollment", type: "number", unit: "students" },
        ],
        rows: rows.map((row) => ({ studentId: row.studentId, course: row.course, value: 1 })),
      };
    else if (request.groupBy) {
      const matrix = request.groupBy === "courseCampus";
      const daily = request.groupBy === "teachingDay";
      const groups = new Map<string, typeof students>();
      for (const row of rows) {
        const key = matrix
          ? JSON.stringify([row.course, row.campus])
          : String(daily ? row.day : Reflect.get(row, request.groupBy));
        groups.set(key, [...(groups.get(key) ?? []), row]);
      }
      table = {
        kind: matrix ? "matrix" : daily ? "series" : "ranked",
        omitted: 0,
        ...(matrix
          ? { axes: { x: "course", y: "campus", value: "value" } }
          : { grouping: "category" }),
        columns: [
          ...(matrix
            ? [
                { key: "course", label: "Course", type: "category" as const },
                { key: "campus", label: "Campus", type: "category" as const },
              ]
            : [
                {
                  key: "category",
                  label: daily
                    ? "Teaching day"
                    : request.groupBy === "schoolId"
                      ? "School"
                      : "Course",
                  type: daily ? ("date" as const) : ("category" as const),
                },
              ]),
          { key: "value", label: "Students", type: "number", unit: capability.unit },
          { key: "numerator", label: "Count", type: "number" },
          { key: "denominator", label: "Enrolled", type: "number" },
        ],
        rows: [...groups]
          .map(([category, students]) => {
            const numerator =
              request.metric === "completion"
                ? students.filter((row) => row.passed).length
                : students.length;
            return {
              ...(matrix
                ? { course: students[0]!.course, campus: students[0]!.campus }
                : { category }),
              value:
                request.metric === "completion" ? (numerator / students.length) * 100 : numerator,
              numerator,
              denominator: students.length,
            };
          })
          .sort((a, b) =>
            daily
              ? String("category" in a ? a.category : "").localeCompare(
                  String("category" in b ? b.category : ""),
                )
              : b.value - a.value,
          ),
      };
    }
    return {
      metric: request.metric,
      request,
      status: value === null ? "unavailable" : "available",
      value,
      unit: capability.unit,
      numerator,
      denominator,
      reason: value === null ? "No enrolled students." : null,
      ...(request.period ? { period: request.period } : {}),
      ...(table ? { table } : {}),
      provenance: {
        sourceId: descriptor.id,
        sourceVersion: descriptor.version,
        datasetVersion: descriptor.datasetVersion,
        metricVersion: descriptor.metricVersion,
        coverage: educationPeriod,
        asOf: descriptor.asOf,
        complete: true,
        operations: [
          { kind: "read", statement: "Read synthetic enrollment records", parameters: [] },
        ],
      },
    };
  }
  close() {}
}
