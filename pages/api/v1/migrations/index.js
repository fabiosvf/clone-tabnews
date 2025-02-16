import { createRouter } from "next-connect";
// import migrationRunner from "node-pg-migrate";
// import { resolve } from "node:path";
// import database from "infra/database";
import controller from "infra/controllers";
import migrator from "models/migrator";

const router = createRouter();

router.get(getHandler);
router.post(postHandler);

export default router.handler(controller.errorHandlers);

async function getHandler(request, response) {
    const pendingMigrations = await migrator.listPendingMigrations();
    return response.status(200).json(pendingMigrations);
}

async function postHandler(request, response) {
  const migratedMigrations = await migrator.runPendingMigrations();
  
  if (migratedMigrations.length > 0) {
    response.status(201).json(migratedMigrations);
  }

    response.status(200).json(migratedMigrations);
}
