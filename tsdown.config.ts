import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["./src/index.ts", "./src/client/index.ts", "./src/host/index.ts"],
	platform: "neutral",
});
