import useSWR from "swr";

async function fetchAPI(key) {
  const response = await fetch(key);
  const responseBody = await response.json();
  return responseBody;
}

export default function StatusPage() {
  const response = useSWR("/api/v1/status", fetchAPI, {
    refreshInterval: 2000
  });
  
  return (
    <>
      <h1>Status</h1>
      <UpdatedAt />
      <DatabaseStatus />
    </>
  )
}

function UpdatedAt() {
  const { isLoading, data } = useSWR("/api/v1/status", fetchAPI, {
    refreshInterval: 2000
  });
  let updatedAtText = "Carregando...";
  if (!isLoading && data) {
    updatedAtText = new Date(data.updated_at).toLocaleString("pt-BR");
  }
  return <div>Última atualização: {updatedAtText}</div>
}

function DatabaseStatus() {
  const { isLoading, data } = useSWR("/api/v1/status", fetchAPI, {
    refreshInterval: 2000,
  });

  let databaseVersion = "Carregando...";
  let databaseMaxConnections = "Carregando...";
  let databaseOpenedConnections = "Carregando...";

  if (!isLoading && data) {
    databaseVersion = data.dependencies.database.version;
    databaseMaxConnections = data.dependencies.database.max_connections;
    databaseOpenedConnections = data.dependencies.database.opened_connections;
  }
  return (
    <>
      <div>Versão do Postgres: {databaseVersion}</div>
      <div>Quantidade de Conexões Máximas: {databaseMaxConnections}</div>
      <div>Quantidade de Conexões Abertas: {databaseOpenedConnections}</div>
    </>
  );
}
