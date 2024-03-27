import database from "infra/database.js";

beforeAll(cleanDatabase);

async function cleanDatabase() {
  await database.query("drop schema public cascade; create schema public;");
}

async function getHasMigrationTable() {
  const res = await database.query(`
    SELECT EXISTS (
      SELECT FROM pg_catalog.pg_tables
      WHERE schemaname = 'public'
      AND tablename = 'pgmigrations'
    );
  `);
  return res.rows[0].exists;
}

async function getNumMigrationsApplied() {
  let num = 0;

  if (getHasMigrationTable()) {
    const res = await database.query(`
      SELECT COUNT(1) as num
      FROM pgmigrations;
    `);
    num = parseInt(res.rows[0]["num"]);
  }

  return num;
}

test("POST to /api/v1/migrations should return 200", async () => {
  // Tabela `pgmigrations` não deve existir antes do processo
  let hasMigrationTable = await getHasMigrationTable();
  expect(hasMigrationTable).toBe(false);

  const response = await fetch("http://localhost:3000/api/v1/migrations", {
    method: "POST",
  });
  expect(response.status).toBe(200);

  // Tabela `pgmigrations` deve existir após o processo
  hasMigrationTable = await getHasMigrationTable();
  expect(hasMigrationTable).toBe(true);

  const responseBody = await response.json();

  // Retorno da API deve ser um array com uma lista de Migrations
  expect(Array.isArray(responseBody)).toBe(true);
  expect(responseBody.length).toBeGreaterThan(0);

  // O número de Migrations obtidas da API deve ser igual ao que foi aplicado no Banco de Dados
  const numMigrationsApplied = await getNumMigrationsApplied();
  expect(numMigrationsApplied).toBe(responseBody.length);
});
