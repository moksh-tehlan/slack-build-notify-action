const core = require('@actions/core');
const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');
async function uploadFile(token, filePath, channel, fileName, fileComment) {
    try {
        // Get file size
        const fileStats = fs.statSync(filePath);
        
        console.log('Getting upload URL...');
        
        // Step 1: Get upload URL
        const getUrlResponse = await axios.post('https://slack.com/api/files.getUploadURLExternal', {
            filename: fileName,
            length: fileStats.size,
            snippable: false,
            title: fileName
        }, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('Upload URL response:', getUrlResponse.data);

        if (!getUrlResponse.data.ok) {
            throw new Error(`Failed to get upload URL: ${getUrlResponse.data.error}`);
        }

        // Step 2: Upload to the URL
        const { upload_url, file_id } = getUrlResponse.data;
        const fileContent = fs.readFileSync(filePath);
        
        console.log('Uploading file content...');
        
        const form = new FormData();
        form.append('file', fileContent, {
            filename: fileName,
            contentType: 'application/vnd.android.package-archive'
        });

        const uploadResponse = await axios.post(upload_url, form, {
            headers: {
                ...form.getHeaders()
            }
        });

        if (uploadResponse.status !== 200) {
            throw new Error('Failed to upload file content');
        }

        console.log('Completing upload...');

        // Step 3: Complete the upload
        const completeResponse = await axios.post('https://slack.com/api/files.completeUploadExternal', {
            files: [{
                id: file_id,
                title: fileName
            }],
            channel_ids: [channel]
        }, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!completeResponse.data.ok) {
            throw new Error(`Failed to complete upload: ${completeResponse.data.error}`);
        }

        return completeResponse.data;
    } catch (error) {
        console.error('Upload error details:', error.response?.data || error.message);
        throw new Error(`File upload failed: ${error.message}`);
    }
}

async function run() {
    try {
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

        // Send notification
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

        // Upload file using new process
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