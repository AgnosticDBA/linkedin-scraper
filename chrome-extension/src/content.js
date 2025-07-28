console.log('LinkedIn Feed Scraper: Content script loaded - Version 1.0.4');
console.log('Current URL:', window.location.href);
console.log('Document ready state:', document.readyState);
console.log('Chrome runtime available:', typeof chrome !== 'undefined' && typeof chrome.runtime !== 'undefined');

class LinkedInFeedScraper {
    constructor() {
        this.posts = [];
        this.isScrapingActive = false;
        this.webhookUrl = '';
        this.maxPosts = 25;
        this.scrapedPosts = new Set();
        
        this.init();
    }

    async init() {
        const result = await chrome.storage.sync.get(['webhookUrl', 'maxPosts', 'autoScrape', 'bearIntegration']);
        this.webhookUrl = result.webhookUrl || 'http://localhost:3000/webhook/linkedin-feed';
        this.maxPosts = result.maxPosts || 25;
        
        this.addScraperUI();
        
        if (result.autoScrape) {
            setTimeout(() => this.startScraping(), 2000);
        }
        
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'startScraping') {
                this.startScraping();
                sendResponse({success: true});
            } else if (request.action === 'getStatus') {
                sendResponse({
                    isActive: this.isScrapingActive,
                    postsFound: this.posts.length,
                    url: window.location.href
                });
            }
        });
    }

    addScraperUI() {
        const scraperButton = document.createElement('div');
        scraperButton.id = 'linkedin-scraper-button';
        scraperButton.innerHTML = `
            <div style="
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                background: #0073b1;
                color: white;
                padding: 10px 15px;
                border-radius: 5px;
                cursor: pointer;
                font-family: Arial, sans-serif;
                font-size: 12px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                user-select: none;
            ">
                📊 Scrape Feed
            </div>
        `;
        
        scraperButton.addEventListener('click', () => {
            if (!this.isScrapingActive) {
                this.startScraping();
            }
        });
        
        document.body.appendChild(scraperButton);
    }

    async startScraping() {
        if (this.isScrapingActive) {
            console.log('Scraping already in progress');
            return;
        }

        console.log('Starting LinkedIn feed scraping...');
        this.isScrapingActive = true;
        this.posts = [];
        this.scrapedPosts.clear();
        
        const button = document.querySelector('#linkedin-scraper-button div');
        if (button) {
            button.innerHTML = '⏳ Scraping...';
            button.style.background = '#f39c12';
        }

        try {
            await this.scrollAndCollectPosts();
            
            await this.sendToWebhook();
            
            if (button) {
                button.innerHTML = `✅ Found ${this.posts.length} posts`;
                button.style.background = '#27ae60';
                setTimeout(() => {
                    button.innerHTML = '📊 Scrape Feed';
                    button.style.background = '#0073b1';
                }, 3000);
            }
            
        } catch (error) {
            console.error('Scraping error:', error);
            
            if (button) {
                button.innerHTML = '❌ Error';
                button.style.background = '#e74c3c';
                setTimeout(() => {
                    button.innerHTML = '📊 Scrape Feed';
                    button.style.background = '#0073b1';
                }, 3000);
            }
        }
        
        this.isScrapingActive = false;
    }

    async scrollAndCollectPosts() {
        console.log('Scrolling and collecting posts...');
        
        this.collectVisiblePosts();
        
        let scrollAttempts = 0;
        const maxScrollAttempts = 10;
        let lastPostCount = this.posts.length;
        
        while (scrollAttempts < maxScrollAttempts && this.posts.length < this.maxPosts) {
            window.scrollBy(0, 1000);
            
            await this.sleep(2000);
            
            this.collectVisiblePosts();
            
            if (this.posts.length === lastPostCount) {
                scrollAttempts++;
            } else {
                scrollAttempts = 0; // Reset if we found new posts
                lastPostCount = this.posts.length;
            }
            
            console.log(`Scroll attempt ${scrollAttempts}, found ${this.posts.length} posts`);
        }
        
        window.scrollTo(0, 0);
        
        console.log(`Scraping completed. Found ${this.posts.length} posts`);
    }

    collectVisiblePosts() {
        console.log('=== DEBUG: Starting post collection ===');
        console.log('Current URL:', window.location.href);
        console.log('Page title:', document.title);
        
        const postSelectors = [
            'div[data-urn*="urn:li:activity"]',
            '.feed-shared-update-v2',
            '[data-id^="urn:li:activity:"]',
            'article',
            '.scaffold-finite-scroll__content > div > div',
            'div[class*="feed"][class*="update"]'
        ];

        let postElements = [];
        
        console.log('Testing selectors:');
        for (const selector of postSelectors) {
            const elements = document.querySelectorAll(selector);
            console.log(`  ${selector}: ${elements.length} elements`);
            if (elements.length > 0 && postElements.length === 0) {
                postElements = elements;
                console.log(`✅ Using selector: ${selector} (found ${postElements.length} elements)`);
            }
        }

        if (postElements.length === 0) {
            console.log('No posts found with standard selectors, trying additional patterns...');
            const additionalSelectors = [
                '.scaffold-finite-scroll__content > div',
                '[data-urn]',
                '.feed-shared-update-v2__content',
                '.update-v2-social-activity',
                'div[class*="update"]',
                'div[class*="feed"]'
            ];
            
            for (const selector of additionalSelectors) {
                const elements = document.querySelectorAll(selector);
                console.log(`  Additional ${selector}: ${elements.length} elements`);
                if (elements.length > 0 && postElements.length === 0) {
                    postElements = elements;
                    console.log(`✅ Using additional selector: ${selector}`);
                    break;
                }
            }
        }

        if (postElements.length === 0) {
            console.log('❌ No post elements found with any selector');
            console.log('Available elements on page:');
            console.log('  Total divs:', document.querySelectorAll('div').length);
            console.log('  Elements with data-urn:', document.querySelectorAll('[data-urn]').length);
            console.log('  Elements with data-id:', document.querySelectorAll('[data-id]').length);
            console.log('  Articles:', document.querySelectorAll('article').length);
            return;
        }

        console.log(`Processing ${postElements.length} post elements...`);
        
        postElements.forEach((postElement, index) => {
            try {
                console.log(`\n--- Processing Post ${index + 1} ---`);
                console.log('Element classes:', postElement.className);
                console.log('Element data-urn:', postElement.getAttribute('data-urn'));
                console.log('Element data-id:', postElement.getAttribute('data-id'));
                
                const isAdvertisement = postElement.textContent.includes('Promoted');
                if (isAdvertisement) {
                    console.log(`❌ Skipped post ${index + 1}: Advertisement detected`);
                    return;
                }

                const postData = this.extractPostData(postElement);
                
                console.log(`Post ${index + 1} extracted data:`, {
                    author: postData.author,
                    authorLength: postData.author.length,
                    postText: postData.postText.substring(0, 100) + '...',
                    hasText: !!postData.postText && postData.postText !== 'No text content',
                    timestamp: postData.timestamp,
                    hasTimestamp: !!postData.timestamp && postData.timestamp !== 'Unknown time',
                    externalURL: postData.externalURL,
                    hasURL: !!postData.externalURL && postData.externalURL !== 'No URL available'
                });
                
                const postId = postData.externalURL || `${postData.author}-${postData.postText.substring(0, 50)}`;
                
                const validationChecks = {
                    hasValidAuthor: postData.author && postData.author !== 'Unknown Author' && postData.author.length > 2 && 
                                   !postData.author.includes('•') && !postData.author.includes('followers') && 
                                   !postData.author.includes('Premium') && !postData.author.match(/^\d+/),
                    alreadyScraped: this.scrapedPosts.has(postId),
                    reachedMaxPosts: this.posts.length >= this.maxPosts,
                    authorFound: postData.author
                };
                
                if (validationChecks.hasValidAuthor && !validationChecks.alreadyScraped && !validationChecks.reachedMaxPosts) {
                    this.posts.push(postData);
                    this.scrapedPosts.add(postId);
                    console.log(`✅ Added post ${this.posts.length}: ${postData.author}`);
                } else {
                    console.log(`❌ Skipped post ${index + 1}:`, validationChecks);
                    if (!validationChecks.hasValidAuthor) {
                        console.log(`   Author issue: "${postData.author}" (length: ${postData.author.length})`);
                    }
                }
            } catch (error) {
                console.error(`Error extracting post ${index}:`, error);
            }
        });
        
        console.log(`Collection complete: ${this.posts.length} valid posts found`);
    }

    extractPostData(postElement) {
        const authorSelectors = [
            'a[href*="/in/"] span.visually-hidden',
            'a[href*="/company/"] span.visually-hidden', 
            
            'a[href*="/in/"] .visually-hidden',
            'a[href*="/company/"] .visually-hidden',
            '.update-components-actor__single-line-truncate',
            
            '.update-components-actor__name',
            '.feed-shared-actor__name',
            'a[data-control-name="actor_container"] span[aria-hidden="false"]',
            '.feed-shared-actor__name span[aria-hidden="false"]',
            '.update-components-actor__name span',
            '.feed-shared-update-v2__actor-name'
        ];

        let author = 'Unknown Author';
        console.log('  Testing author selectors...');
        for (const selector of authorSelectors) {
            const element = postElement.querySelector(selector);
            if (element && element.textContent.trim()) {
                author = element.textContent.trim();
                console.log(`    ✅ Found author: "${author}" using ${selector}`);
                break;
            }
        }

        if (author === 'Unknown Author') {
            console.log('  No author found with standard selectors, trying fallback methods...');
            
            const profileLinks = postElement.querySelectorAll('a[href*="/in/"], a[href*="/company/"]');
            for (const link of profileLinks) {
                const hiddenSpans = link.querySelectorAll('.visually-hidden');
                for (const span of hiddenSpans) {
                    const text = span.textContent.trim();
                    if (text && text.length > 2 && text.length < 100 && 
                        !text.includes('•') && !text.includes('ago') && 
                        !text.includes('Follow') && !text.includes('followers') && 
                        !text.includes('3rd+') && !text.includes('Premium') &&
                        !text.match(/^\d+/) && !text.includes('connections') &&
                        !text.includes('views') && !text.includes('reactions')) {
                        author = text;
                        console.log(`    ✅ Fallback method found author: "${author}"`);
                        break;
                    }
                }
                if (author !== 'Unknown Author') break;
            }
        }

        const textSelectors = [
            '.feed-shared-text',
            '.update-components-text',
            '[data-test-id="main-feed-activity-card"] .break-words',
            '.feed-shared-update-v2__commentary',
            '.feed-shared-text__text-view',
            '.break-words span[dir="ltr"]',
            '.feed-shared-text span',
            '.update-components-text span',
            '.feed-shared-text .break-words',
            '.update-components-text .break-words',
            '[data-test-id*="post-text"]',
            '.feed-shared-update-v2__commentary .break-words'
        ];

        let postText = '';
        for (const selector of textSelectors) {
            const element = postElement.querySelector(selector);
            if (element && element.textContent.trim()) {
                postText = element.textContent.trim();
                break;
            }
        }

        const timestampSelectors = [
            '.update-components-actor__sub-description',
            '.feed-shared-actor__sub-description',
            'time',
            '.feed-shared-actor__sub-description time',
            '.update-components-actor__sub-description time',
            '[data-test-id="main-feed-activity-card"] time'
        ];

        let timestamp = '';
        for (const selector of timestampSelectors) {
            const element = postElement.querySelector(selector);
            if (element && element.textContent.trim()) {
                timestamp = element.textContent.trim();
                break;
            }
        }

        let externalURL = '';
        console.log(`  === URL EXTRACTION DEBUG ===`);
        
        const activitySelectors = [
            'a[href*="activity-"][href*="urn:li:activity"]',
            'a[href*="/posts/"][href*="_activity-"]',
            'a[data-control-name="overlay"][href*="activity"]',
            'a[href*="feed/update/urn:li:activity"]'
        ];
        
        for (const selector of activitySelectors) {
            const element = postElement.querySelector(selector);
            if (element && element.href) {
                externalURL = element.href;
                console.log(`  ✅ Found activity URL: ${externalURL}`);
                break;
            }
        }
        
        if (!externalURL) {
            const linkElement = postElement.querySelector('a[href*="/posts/"], a[href*="/feed/update/"]');
            console.log(`  Current selector result:`, linkElement ? linkElement.href : 'NOT FOUND');
            
            if (linkElement) {
                const href = linkElement.getAttribute('href');
                if (href) {
                    externalURL = href.startsWith('http') ? href : `https://linkedin.com${href}`;
                    console.log(`  ✅ URL found with fallback selector: ${externalURL}`);
                }
            } else {
                const allLinks = postElement.querySelectorAll('a[href]');
                console.log(`  Total links in post: ${allLinks.length}`);
                
                const potentialUrls = [];
                allLinks.forEach((link, idx) => {
                    const href = link.getAttribute('href');
                    if (href && (href.includes('linkedin.com') || href.startsWith('/'))) {
                        console.log(`    Link ${idx + 1}: ${href}`);
                        if (href.includes('activity') || href.includes('post') || href.includes('feed') || href.includes('urn:li:activity')) {
                            console.log(`      *** POTENTIAL POST URL: ${href}`);
                            potentialUrls.push(href);
                        }
                    }
                });
                
                const alternativeSelectors = [
                    'a[href*="activity"]',
                    'a[href*="urn:li:activity"]', 
                    'a[data-control-name*="post"]',
                    'a[data-control-name*="activity"]',
                    '.feed-shared-actor__name a',
                    '.update-components-actor__name a'
                ];
                
                for (const selector of alternativeSelectors) {
                    const altElement = postElement.querySelector(selector);
                    if (altElement && altElement.href) {
                        console.log(`    Alternative selector "${selector}" found: ${altElement.href}`);
                        if (altElement.href.includes('activity') || altElement.href.includes('post')) {
                            externalURL = altElement.href;
                            console.log(`  ✅ URL found with alternative selector: ${externalURL}`);
                            break;
                        }
                    }
                }
                
                if (!externalURL && potentialUrls.length > 0) {
                    externalURL = potentialUrls[0].startsWith('http') ? potentialUrls[0] : `https://linkedin.com${potentialUrls[0]}`;
                    console.log(`  ✅ URL found from potential URLs: ${externalURL}`);
                }
            }
        }
        
        console.log(`  Final URL result: ${externalURL || 'No URL available'}`);
        console.log(`  === END URL EXTRACTION DEBUG ===`);

        return {
            author,
            postText: postText || 'No text content',
            timestamp: timestamp || 'Unknown time',
            externalURL: externalURL || 'No URL available',
            mediaAttachments: this.extractMediaAttachments(postElement)
        };
    }

    extractMediaAttachments(postElement) {
        const mediaAttachments = [];
        
        const images = postElement.querySelectorAll('img[src*="media"], img[src*="image"], .feed-shared-image img');
        images.forEach(img => {
            if (img.src && !img.src.includes('profile-photo') && !img.src.includes('logo')) {
                mediaAttachments.push({
                    type: 'image',
                    url: img.src,
                    alt: img.alt || 'LinkedIn image'
                });
            }
        });
        
        const docLinks = postElement.querySelectorAll('a[href*=".pdf"], a[href*="document"], .feed-shared-article');
        docLinks.forEach(link => {
            if (link.href) {
                mediaAttachments.push({
                    type: 'document',
                    url: link.href,
                    title: link.textContent.trim() || 'LinkedIn document'
                });
            }
        });
        
        return mediaAttachments;
    }

    async sendToWebhook() {
        if (!this.webhookUrl) {
            console.error('No webhook URL configured');
            return;
        }

        const payload = {
            success: true,
            count: this.posts.length,
            data: this.posts,
            source: 'chrome-extension',
            timestamp: new Date().toISOString(),
            url: window.location.href
        };

        try {
            console.log(`Sending ${this.posts.length} posts to webhook via background script:`, this.webhookUrl);
            
            const response = await chrome.runtime.sendMessage({
                action: 'sendWebhook',
                url: this.webhookUrl,
                payload: payload
            });

            if (response && response.success) {
                console.log('Successfully sent data to webhook via background script');
            } else {
                console.error('Background script webhook request failed:', response);
            }
            
            const settings = await chrome.storage.sync.get(['bearIntegration']);
            if (settings.bearIntegration) {
                const bearWebhookUrl = this.webhookUrl.replace('/webhook/linkedin-feed', '/webhook/linkedin-to-bear');
                console.log('Sending to Bear integration endpoint:', bearWebhookUrl);
                
                const bearResponse = await chrome.runtime.sendMessage({
                    action: 'sendWebhook',
                    url: bearWebhookUrl,
                    payload: payload
                });
                
                if (bearResponse && bearResponse.success) {
                    console.log('Successfully sent data to Bear integration');
                } else {
                    console.error('Bear integration request failed:', bearResponse);
                }
            }
            
        } catch (error) {
            console.error('Error sending to background script:', error);
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new LinkedInFeedScraper();
    });
} else {
    new LinkedInFeedScraper();
}
