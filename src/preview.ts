import { createServer } from "vite";
import { loadMarkdown, convertToHtml } from "./mailer.js";
import chalk from "chalk";
import fs from "fs/promises";

export async function startPreview(filePath: string): Promise<void> {
  let currentHtml = await convertToHtml(await loadMarkdown(filePath));
  let lastModified = 0;

  const server = await createServer({
    server: {
      port: 3000,
      open: true, // Auto-open browser
    },
    plugins: [
      {
        name: "markdown-hot-reload",
        configureServer(server) {
          // Serve the HTML
          server.middlewares.use((req, res, next) => {
            if (req.url === "/" || req.url === "/index.html") {
              res.setHeader("Content-Type", "text/html");
              res.end(currentHtml);
            } else {
              next();
            }
          });

          // Watch the markdown file for changes
          const watchFile = async () => {
            try {
              const stats = await fs.stat(filePath);

              if (stats.mtimeMs > lastModified) {
                lastModified = stats.mtimeMs;

                const markdown = await loadMarkdown(filePath);
                const newHtml = await convertToHtml(markdown);

                if (newHtml !== currentHtml) {
                  currentHtml = newHtml;
                  server.ws.send({ type: "full-reload" });
                  console.log(
                    chalk.green("♻️  Reloaded"),
                    new Date().toLocaleTimeString(),
                  );
                }
              }
            } catch (error) {
              console.error(chalk.red("Error watching file:"), error);
            }
          };

          // Poll for changes every second
          setInterval(watchFile, 1000);
        },
      },
    ],
  });

  await server.listen();

  console.log(chalk.green("✨ Preview server running"));
  console.log(chalk.cyan(`   Local:   http://localhost:3000`));
  console.log(chalk.gray(`   Watching: ${filePath}`));
  console.log(chalk.yellow("\n   Press Ctrl+C to stop\n"));
}
