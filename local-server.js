const http = require('http');
const { handler } = require('./src/register/app');

// Crear un servidor local ligero que simule AWS API Gateway
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  
  // Agregar soporte para CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST,GET');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Rutear endpoint específico
  if (url.pathname === '/v1/auth/register') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', async () => {
      // Simular el evento que API Gateway le pasaría a Lambda
      const event = {
        httpMethod: req.method,
        path: url.pathname,
        headers: req.headers,
        body: body || null
      };
      
      try {
        // Ejecutar nuestra función Lambda real
        const response = await handler(event);
        
        // Retornar la respuesta al cliente
        const statusCode = response.statusCode || 200;
        const headers = response.headers || { 'Content-Type': 'application/json' };
        
        res.writeHead(statusCode, headers);
        res.end(response.body);
      } catch (error) {
        console.error('Error interno ejecutando el handler:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal Server Error', detalle: error.message }));
      }
    });
  } else {
    // Si no es la ruta de registro, retornar 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Ruta no encontrada (404)' }));
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🚀 [Servidor Local] Listo para desarrollo`);
  console.log(`👉 Corriendo en http://localhost:${PORT}`);
  console.log(`\nEndpoints probables:`);
  console.log(`- POST http://localhost:${PORT}/v1/auth/register`);
  console.log(`\n(Este servidor te permite probar sin usar Docker)`);
});
