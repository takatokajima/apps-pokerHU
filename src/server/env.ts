// .env があれば読み込む（無くても動く）
try {
  process.loadEnvFile();
} catch {
  /* .env 無し */
}
