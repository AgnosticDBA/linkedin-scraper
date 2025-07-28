const { exec } = require('child_process');

const samplePost = {
    author: 'Test Author',
    postText: 'This is a test LinkedIn post for Bear integration.',
    timestamp: '1h ago',
    externalURL: 'https://linkedin.com/posts/test-activity-123'
};

function createBearNote(linkedinPost) {
    const title = `LinkedIn: ${linkedinPost.author}`;
    const text = `${linkedinPost.postText}\n\n**Source:** ${linkedinPost.externalURL}\n**Posted:** ${linkedinPost.timestamp}`;
    const tags = 'linkedin,social-media';
    
    return `bear://x-callback-url/create?` +
        `title=${encodeURIComponent(title)}&` +
        `text=${encodeURIComponent(text)}&` +
        `tags=${encodeURIComponent(tags)}`;
}

const bearUrl = createBearNote(samplePost);
console.log('Bear URL:', bearUrl);

exec(`open "${bearUrl}"`, (error, stdout, stderr) => {
    if (error) {
        console.error('Error opening Bear URL:', error);
    } else {
        console.log('Bear URL opened successfully');
    }
});
