require('dotenv').config();
const { Octokit } = require('@octokit/rest');
const express = require('express');
const cors = require('cors');
const https = require('https');
const fs = require('fs');

const GITHUB_AUTH_TOKEN = process.env.GITHUB_AUTH_TOKEN;

const octokit = new Octokit({
    auth: GITHUB_AUTH_TOKEN,
});

const privateKey = fs.readFileSync('key.pem', 'utf8');
const certificate = fs.readFileSync('certificate.pem', 'utf8');
const credentials = { key: privateKey, cert: certificate };

const PORT = process.env.PORT || 443;
const app = express();
app.use(express.json());
app.use(cors());

app.get('/', async (request, response) => {
    response.send('<h1>hello, why you here man</h1>');
});

app.get('/mods', async (request, response) => {
    console.log(`Endpoint /mods`);

    const mods = await await octokit.paginate(octokit.search.repos, { q: 'topic:pokeroguemod' });
    response.send(
        mods.map((mod) => ({
            name: mod.name,
            author: mod.owner.login,
        }))
    );
});

app.get('/mod', async (request, response) => {
    console.log(`Endpoint /mod : query ${JSON.stringify(request.query)}`);

    const mods = await octokit.paginate(octokit.search.repos, { q: 'topic:pokeroguemod' });
    let modData = mods.find((mod) => mod.name === request.query.name && mod.owner.login === request.query.author);

    const modfiles = await octokit.rest.repos.getContent({
        owner: modData.owner.login,
        repo: modData.name,
        path: '',
    });

    const modjson = modfiles.data.find((file) => file.path === 'mod.json');
    if (!modjson) {
        response.status(400).send({
            message: 'Missing mod.json from mods root directory',
        });
        return;
    }

    let modjsonData = await fetch(modjson.download_url);
    try {
        modjsonData = await modjsonData.json();
    } catch (e) {
        response.status(400).send({
            message: 'mod.json file has invalid JSON structure',
        });
        return;
    }

    const mod = {
        name: modData.name,
        author: modData.owner.login,
        version: modjsonData.version || '1.0',
        description: modjsonData.description || '',
        url: modData.html_url,
        scripts: modfiles.data.filter((script) => script.name.endsWith('.js')),
    };

    return response.send(mod);
});

const httpsServer = https.createServer(credentials, app);

httpsServer.listen(PORT, () => {
    console.log('Server listening on PORT:', PORT);
});
