const core = require('@actions/core');
const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');

async function run() {
    try {
        // Get inputs from action.yml
        const webhookUrl = core.getInput('slack-webhook-url');
        const token = core.getInput('slack-bot-token');
        const channel = core.getInput('channel');
        const filePath = core.getInput('file-path');
        const buildNumber = core.getInput('build-number');
        const buildStatus = core.getInput('build-status');
        const commitUrl = core.getInput('commit-url');

        console.log('Sending build notification to Slack...');

        // Send build notification via webhook
        await axios.post(webhookUrl, {
            text: "*GitHub Action build result*: " + buildStatus,
            blocks: [
                {
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: `*Build Details:*\n• Status: ${buildStatus}\n• Build: #${buildNumber}\n• Commit: ${commitUrl}`
                    }
                }
            ]
        });

        console.log('Uploading APK file to Slack...');

        // Upload APK file
        const form = new FormData();
        form.append('file', fs.createReadStream(filePath));
        form.append('channels', channel);
        form.append('initial_comment', `📱 APK for build #${buildNumber}`);

        const response = await axios.post('https://slack.com/api/files.upload', form, {
            headers: {
                'Authorization': `Bearer ${token}`,
                ...form.getHeaders()
            }
        });

        if (!response.data.ok) {
            throw new Error(`Slack API Error: ${response.data.error}`);
        }

        console.log('Successfully sent notification and APK to Slack!');

    } catch (error) {
        core.setFailed(`Action failed: ${error.message}`);
    }
}

run();