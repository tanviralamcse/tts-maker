import express from "express";
import { createServer as createViteServer } from "vite";
import Replicate from "replicate";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Replicate Image Generation API
  app.post("/api/generate-image", async (req, res) => {
    try {
      const { prompt, aspectRatio } = req.body;
      
      if (!process.env.REPLICATE_API_TOKEN) {
        return res.status(500).json({ error: "REPLICATE_API_TOKEN is not configured" });
      }

      const replicate = new Replicate({
        auth: process.env.REPLICATE_API_TOKEN,
      });

      // Mapping aspect ratio to flux-schnell supported inputs if needed
      // flux-schnell usually takes width/height or aspect_ratio depending on version
      // For black-forest-labs/flux-schnell, it takes aspect_ratio
      
      const input = {
        prompt: prompt,
        aspect_ratio: aspectRatio === "9:16" ? "9:16" : "16:9",
      };

      console.log("Generating image with Replicate:", input);
      const output: any = await replicate.run("black-forest-labs/flux-schnell", { input });
      
      // output is usually an array of file objects or strings
      if (Array.isArray(output) && output.length > 0) {
        const imageUrl = typeof output[0] === 'string' ? output[0] : (output[0].url ? output[0].url() : String(output[0]));
        res.json({ url: imageUrl });
      } else {
        res.status(500).json({ error: "Failed to generate image" });
      }
    } catch (error: any) {
      console.error("Replicate error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile("dist/index.html", { root: "." });
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
