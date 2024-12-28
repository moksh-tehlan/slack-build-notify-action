const core = require('@actions/core');
const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');

async function uploadFile(token, filePath, channel, fileName, fileComment) {
    try {
        // Get exact file size
        const fileStats = fs.statSync(filePath);
        
        // Step 1: Get upload URL
        const getUrlResponse = await axios({
            method: 'post',
            url: 'https://slack.com/api/files.getUploadURLExternal',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: {
                filename: fileName,
                length: fileStats.size
            }
        });

        if (!getUrlResponse.data.ok) {
            throw new Error(`Failed to get upload URL: ${getUrlResponse.data.error}`);
        }

        const { upload_url, file_id } = getUrlResponse.data;

        // Step 2: Upload file to the URL
        const form = new FormData();
        form.append('file', fs.createReadStream(filePath));

        const uploadResponse = await axios({
            method: 'post',
            url: upload_url,
            headers: {
                ...form.getHeaders()
            },
            data: form
        });

        if (uploadResponse.status !== 200) {
            throw new Error('Failed to upload file content');
        }

        // Step 3: Complete upload with channel sharing
        const completeResponse = await axios({
            method: 'post',
            url: 'https://slack.com/api/files.completeUploadExternal',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            data: {
                files: [{
                    "id": file_id,
                    "title": fileName
                }],
                channel_id: channel,
                initial_comment: fileComment
            }
        });

        if (!completeResponse.data.ok) {
            throw new Error(`Failed to complete upload: ${completeResponse.data.error}`);
        }

        return completeResponse.data;
    } catch (error) {
        if (error.response?.data) {
            console.error('API Error Details:', error.response.data);
        }
        throw error;
    }
}

async function run() {
    try {
        // Get inputs
        const webhookUrl = core.getInput('slack-webhook-url');
        const token = core.getInput('slack-bot-token');
        const channel = core.getInput('channel');
        const filePath = core.getInput('file-path');
        const buildNumber = core.getInput('build-number');
        const buildStatus = core.getInput('build-status');
        const commitUrl = core.getInput('commit-url');
        const messageTitle = core.getInput('message-title');
        const messageColor = core.getInput('message-color');
        const appName = core.getInput('app-name');
        const fileComment = core.getInput('file-comment');

        console.log('Sending build notification to Slack...');

        // Send build notification
        await axios.post(webhookUrl, {
            blocks: [
                {
                    type: "header",
                    text: {
                        type: "plain_text",
                        text: messageTitle,
                        emoji: true
                    }
                },
                {
                    type: "section",
                    fields: [
                        {
                            type: "mrkdwn",
                            text: `*App:*\n${appName}`
                        },
                        {
                            type: "mrkdwn",
                            text: `*Status:*\n${buildStatus === 'success' ? '✅' : '❌'}`
                        },
                        {
                            type: "mrkdwn",
                            text: `*Build:*\n#${buildNumber}`
                        },
                        {
                            type: "mrkdwn",
                            text: `*Commit:*\n<${commitUrl}|View>`
                        }
                    ]
                }
            ]
        });

        console.log('Uploading APK file to Slack...');

        const fileName = `${appName}-${buildNumber}.apk`;
        await uploadFile(
            token,
            filePath,
            channel,
            fileName,
            `${fileComment} #${buildNumber}`
        );

        console.log('Successfully sent notification and APK to Slack!');

    } catch (error) {
        core.setFailed(`Action failed: ${error.message}`);
    }
}

run();