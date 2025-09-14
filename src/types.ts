import { z } from "zod";

export const GithubIssueReference = z.object({
  owner: z.string(),
  repo: z.string(),
  number: z.number(),
});

export const GitHubLabelSchema = z.object({
  name: z.string(),
  description: z.string().nullish(),
});

export const GithubLabelAssignmentSchema = z.object({
  name: z.string(),
  reason: z.string(),
});

export const GitHubIssueSchema = z.object({
  reference: GithubIssueReference,
  title: z.string(),
  body: z.string().nullable(),
  labels: z.array(GitHubLabelSchema),
});

export type GitHubIssue = z.infer<typeof GitHubIssueSchema>;
export type GitHubLabel = z.infer<typeof GitHubLabelSchema>;
export type GithubIssueReference = z.infer<typeof GithubIssueReference>;
