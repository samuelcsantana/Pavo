import { z } from 'zod';

export const splitPdfSchema = z.object({
  start: z.string().regex(/^\d+$/, "Start page must be a number").transform(Number),
  end: z.string().regex(/^\d+$/, "End page must be a number").transform(Number),
});

export const compressPdfSchema = z.object({
  removeImages: z.enum(['true', 'false']).optional().transform((val) => val === 'true'),
});
