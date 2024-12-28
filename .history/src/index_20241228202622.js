const core = require('@actions/core');
const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');

async function run() {
    try {
        // Get basic inputs
        const webhookUrl = core.getInput('slack-webhook-url');
        const token = core.getInput('slack-bot-token');
        const channel = core.getInput('channel');
        const filePath = core.getInput('file-path');
        const buildNumber = core.getInput('build-number');
        const buildStatus = core.getInput('build-status');
        const commitUrl = core.getInput('commit-url');

        // Get customization inputs
        const messageTitle = core.getInput('message-title');
        const messageColor = core.getInput('message-color');
        const appName = core.getInput('app-name');
        const fileComment = core.getInput('file-comment');

        console.log('Sending build notification to Slack...');

        // Send build notification with rich formatting
        await axios.post(webhookUrl, {
            blocks: [
                {
                    type: "header",
                    text: {
                        type: "plain_text",
                        text: `${messageTitle} 🚀`,
                        emoji: true
                    }
                },
                {
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: `*${appName}* build status: ${buildStatus === 'success' ? '✅' : '❌'}`
                    }
                },
                {
                    type: "divider"
                },
                {
                    type: "section",
                    fields: [
                        {
                            type: "mrkdwn",
                            text: `*Build Number:*\n#${buildNumber}`
                        },
                        {
                            type: "mrkdwn",
                            text: `*Status:*\n${buildStatus}`
                        }
                    ]
                },
                {
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: `*Commit:*\n<${commitUrl}|View Changes>`
                    }
                }
            ],
            attachments: [
                {
                    color: messageColor,
                    blocks: [
                        {
                            type: "context",
                            elements: [
                                {
                                    type: "mrkdwn",
                                    text: `Build completed at ${new Date().toLocaleString()}`
                                }
                            ]
                        }
                    ]
                }
            ]
        });

        console.log('Uploading APK file to Slack...');

        // Upload APK with custom comment
        const form = new FormData();
        form.append('file', fs.createReadStream(filePath));
        form.append('channels', channel);
        form.append('initial_comment', `${fileComment} #${buildNumber}`);

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