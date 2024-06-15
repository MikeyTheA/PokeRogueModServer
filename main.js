require('dotenv').config();
const { Octokit } = require('@octokit/rest');
const express = require('express');

const GITHUB_AUTH_TOKEN = process.env.GITHUB_AUTH_TOKEN;

const octokit = new Octokit({
    auth: GITHUB_AUTH_TOKEN,
});

(async () => {
    const PORT = process.env.PORT || 3000;
    const app = express();
    app.use(express.json());

    app.listen(PORT, () => {
        console.log('Server listening on PORT:', PORT);
    });

    app.get('/mods', async (request, response) => {
        console.log(`Endpoint /mod`);

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
            scripts: modfiles.data.filter((script) => script.name.endsWith('.js')),
        };

        return response.send(mod);
    });
})();
