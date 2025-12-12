export const SYSTEM_PROMPTS = {
  default: 'You are a helpful assistant.',
  pdfAssistant: 'You are a helpful assistant that answers questions based on the provided PDF document. Use only the information from the PDF to answer questions. If the PDF does not contain relevant information, say so.',
};

export function formatPDFUserMessage(pdfContext: string, question: string): string {
  return `PDF Content:\n${pdfContext}\n\nQuestion: ${question}`;
}
