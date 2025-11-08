#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import { sendNewsletter } from "./mailer.js";
import { startPreview } from "./preview.js";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

dotenv.config();

const program = new Command();

program
  .name("mail-md")
  .description("Send markdown newsletters via Resend")
  .version("1.0.0")
  .argument("<file>", "Markdown file to send")
  .option("-p, --preview", "Preview in browser instead of sending")
  .option("-t, --test <email>", "Send test email to specified address")
  .action(
    async (file: string, options: { preview?: boolean; test?: string }) => {
      try {
        const filePath = path.resolve(file);

        // Check if file exists
        if (!fs.existsSync(filePath)) {
          console.error(chalk.red(`❌ File not found: ${filePath}`));
          process.exit(1);
        }

        if (options.preview) {
          // Preview mode - keeps server running
          console.log(chalk.blue("🔍 Starting preview server...\n"));
          await startPreview(filePath);
        } else if (options.test) {
          // Test mode - send to single email
          const config = {
            apiKey: process.env.RESEND_API_KEY!,
            mailingList: [options.test],
            fromEmail: process.env.FROM_EMAIL!,
            subject: process.env.SUBJECT_PREFIX || "Newsletter",
          };

          if (!config.apiKey || !config.fromEmail) {
            console.error(
              chalk.red("❌ Missing required environment variables"),
            );
            console.log("Required: RESEND_API_KEY, FROM_EMAIL");
            process.exit(1);
          }

          console.log(chalk.yellow("🧪 Sending test email...\n"));
          await sendNewsletter(filePath, config);
          console.log(chalk.green("\n✅ Test email sent!"));
          process.exit(0);
        } else {
          // Send mode - executes and exits
          const config = {
            apiKey: process.env.RESEND_API_KEY!,
            mailingList: process.env
              .MAILING_LIST!.split(",")
              .map((e) => e.trim()),
            fromEmail: process.env.FROM_EMAIL!,
            subject: process.env.SUBJECT_PREFIX || "Newsletter",
          };

          if (
            !config.apiKey ||
            !config.mailingList.length ||
            !config.fromEmail
          ) {
            console.error(
              chalk.red("❌ Missing required environment variables"),
            );
            console.log("Required: RESEND_API_KEY, MAILING_LIST, FROM_EMAIL");
            process.exit(1);
          }

          // Confirmation prompt
          console.log(chalk.yellow("⚠️  About to send newsletter to:"));
          console.log(
            chalk.cyan(`   Recipients: ${config.mailingList.length}`),
          );
          console.log(chalk.cyan(`   File: ${path.basename(filePath)}\n`));

          console.log(chalk.blue("📧 Sending newsletter...\n"));
          await sendNewsletter(filePath, config);
          console.log(chalk.green("\n✅ Newsletter sent successfully!"));
          process.exit(0);
        }
      } catch (error) {
        console.error(chalk.red("❌ Error:"), error);
        process.exit(1);
      }
    },
  );

program.parse();
