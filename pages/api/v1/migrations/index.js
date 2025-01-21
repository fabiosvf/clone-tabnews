import { createRouter } from "next-connect";
import migrationRunner from "node-pg-migrate";
import { resolve } from "node:path";
import database from "infra/database";
import { InternalServerError, MethodNotAllowedError } from "infra/errors";

const router = createRouter();

router.get(getHandler);
router.post(postHandler);

export default router.handler({
  onNoMatch: onNoMatchHandler,
  onError: onErrorHandler,
});

function onNoMatchHandler(request, response) {
  const publicErrorObject = new MethodNotAllowedError();
  response.status(publicErrorObject.statusCode).json(publicErrorObject);
}

function onErrorHandler(error, request, response) {
  const publicErrorObject = new InternalServerError({
    cause: error,
  });

  console.log("\n Erro dentro do catch do next-connect:");
  console.error(publicErrorObject);

  response.status(publicErrorObject.statusCode).json(publicErrorObject);
}

async function getHandler(request, response) {
  let dbClient;
  try {
    dbClient = await database.getNewClient();

    const defaultMigrationOptions = getDefaultMigrationOptions(dbClient, true);

    const pendingMigrations = await migrationRunner(defaultMigrationOptions);

    response.status(200).json(pendingMigrations);
  } finally {
    if (dbClient) await dbClient.end();
  }
}

async function postHandler(request, response) {
  let dbClient;
  try {
    dbClient = await database.getNewClient();

    const defaultMigrationOptions = getDefaultMigrationOptions(dbClient, false);

    const migratedMigrations = await migrationRunner(defaultMigrationOptions);

    if (migratedMigrations.length > 0) {
      response.status(201).json(migratedMigrations);
    }

    response.status(200).json(migratedMigrations);
  } finally {
    if (dbClient) await dbClient.end();
  }
}

function getDefaultMigrationOptions(dbClient, dryRun = true) {
  return {
    dbClient,
    dryRun,
    dir: resolve("infra", "migrations"),
    direction: "up",
    verbose: true,
    migrationsTable: "pgmigrations",
  };
}
