const Docker = require('dockerode');
const docker = new Docker({ socketPath: process.env.DOCKER_SOCK || '/var/run/docker.sock' });
const simpleGit = require('simple-git/promise')(process.env.CLONE_PATH || '/tmp');
const tar = require('tar-fs');
const express = require('express');
const bodyParser = require('body-parser')

const app = express()
app.use(bodyParser.json());

app.post('', async (req, res) => {
    const { cloneUrl, tag, registry, branch } = req.body;
    const cloneDest = `${Math.random().toString(36).substr(2, 9)}/${tag}`;

    if (!cloneUrl || !tag || !registry) return res.status(400).send();

    const log = [];

    try {
        await simpleGit.clone(cloneUrl, cloneDest, branch ? ['--branch', branch] : []);

        const tarStream = tar.pack(`/tmp/${cloneDest}`);

        const stream = await docker.buildImage(tarStream, { t: `${registry}/${tag}` });
        await new Promise((resolve, reject) => {
            const onFinished = (err, output) => {
                err ? reject() : resolve(output)
                console.log(output);
            }

            const onProgress = (event) => {
                log.push(event.stream);
            }

            docker.modem.followProgress(stream, onFinished, onProgress);
        });

        const image = docker.getImage(`${registry}/${tag}`);
        await new Promise((resolve, reject) => {
            image.push({}, (err, stream) => {
                const onFinished = (err, output) => {
                    err ? reject() : resolve(output)
                    console.log(output);
                }

                const onProgress = (event) => {
                    log.push(JSON.stringify(event));
                    console.log(event);
                }

                docker.modem.followProgress(stream, onFinished, onProgress);
            }, {});
        });

        res.json({
            image: `${registry}/${tag}`,
            log: log,
        });
    } catch (error) {
        res.status(500).send({
            error,
            log,
        });
    }
})

app.listen(3005);