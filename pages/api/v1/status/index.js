import database from "infra/database.js";

async function status(request, response) {
  //  return response.status(500).json({ erro: "error" });

  const updatedAt = new Date().toISOString();

  const databaseVersionResult = await database.query("SHOW server_version;");
  const databaseVersionValue = databaseVersionResult.rows[0].server_version;

  const databaseMaxConnectionsResult = await database.query(
    "SHOW max_connections;",
  );
  const databaseMaxConnectionsValue =
    databaseMaxConnectionsResult.rows[0].max_connections;

  const databaseName = process.env.POSTGRES_DB;
  const databaseOpenedConnectionsResult = await database.query({
    text: "SELECT COUNT(1)::int FROM pg_stat_activity WHERE datname = $1;",
    values: [databaseName],
  });

  var databasOpenedConnectionsValue = parseInt(
    databaseOpenedConnectionsResult.rows[0].count,
  );
  /*
  1) Versão do Postgres
  2) Conexões Máximas
  3) Conexões Usadas
  */
  response.status(200).json({
    updated_at: updatedAt,
    dependencies: {
      database: {
        version: databaseVersionValue,
        max_connections: parseInt(databaseMaxConnectionsValue),
        opened_connections: databasOpenedConnectionsValue,
      },
    },
  });
}

export default status;
