import { Resend } from "resend";
import { Marked } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface MailerConfig {
  apiKey: string;
  mailingList: string[];
  fromEmail: string;
  subject: string;
}

// Create a new Marked instance with highlighting
const marked = new Marked(
  markedHighlight({
    langPrefix: "hljs language-",
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : "plaintext";
      return hljs.highlight(code, { language }).value;
    },
  }),
);

export async function loadMarkdown(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch (error) {
    throw new Error(`Failed to read markdown file: ${filePath}`);
  }
}

export async function convertToHtml(markdown: string): Promise<string> {
  const templatePath = path.join(__dirname, "template.html");
  const stylesPath = path.join(__dirname, "styles.css");
  const hlStylesPath = path.join(__dirname, "highlight.css");

  try {
    const template = await fs.readFile(templatePath, "utf-8");
    const styles = await fs.readFile(stylesPath, "utf-8");
    const hlStyles = await fs.readFile(hlStylesPath, "utf-8");

    // Use the marked instance to parse markdown
    const htmlContent = await marked.parse(markdown);

    return template
      .replace("{{STYLES}}", styles + "\n\n" + hlStyles)
      .replace("{{CONTENT}}", htmlContent);
  } catch (error) {
    throw new Error(`Failed to load email template: ${error}`);
  }
}

export async function sendNewsletter(
  filePath: string,
  config: MailerConfig,
): Promise<void> {
  const resend = new Resend(config.apiKey);

  const markdown = await loadMarkdown(filePath);
  const html = await convertToHtml(markdown);

  const match = markdown.match(/^#\s+(.+)$/m);
  const subject = match
    ? `${config.subject} ${match[1]}`.trim()
    : config.subject;

  console.log(`Subject: ${subject}`);
  console.log(`Recipients: ${config.mailingList.length}\n`);

  let successCount = 0;
  let failCount = 0;

  for (const to of config.mailingList) {
    try {
      await resend.emails.send({
        from: config.fromEmail,
        to,
        subject,
        html,
      });
      console.log(`✓ ${to}`);
      successCount++;

      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`✗ ${to}: ${error}`);
      failCount++;
    }
  }

  console.log(`\nSent: ${successCount}, Failed: ${failCount}`);
}
