import myAwesomePlugin from "./plugin.mjs";

export default {
  globs: ["src/**/*.js"],
  dev: true,
  plugins: [myAwesomePlugin()],
};
