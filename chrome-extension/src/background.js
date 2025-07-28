
chrome.runtime.onInstalled.addListener(() => {
    console.log('LinkedIn Feed Scraper extension installed');
    
    chrome.storage.sync.get(['webhookUrl', 'maxPosts', 'autoScrape'], (result) => {
        const defaults = {
            webhookUrl: result.webhookUrl || 'http://localhost:3000/webhook/linkedin-feed',
            maxPosts: result.maxPosts || 25,
            autoScrape: result.autoScrape || false
        };
        
        chrome.storage.sync.set(defaults);
    });
});

chrome.action.onClicked.addListener((tab) => {
    console.log('Extension icon clicked on tab:', tab.url);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        if (tab.url.includes('linkedin.com/feed')) {
            chrome.action.setBadgeText({
                tabId: tabId,
                text: '✓'
            });
            chrome.action.setBadgeBackgroundColor({
                tabId: tabId,
                color: '#0073b1'
            });
        } else if (tab.url.includes('linkedin.com')) {
            chrome.action.setBadgeText({
                tabId: tabId,
                text: '!'
            });
            chrome.action.setBadgeBackgroundColor({
                tabId: tabId,
                color: '#f39c12'
            });
        } else {
            chrome.action.setBadgeText({
                tabId: tabId,
                text: ''
            });
        }
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'scrapingComplete') {
        console.log('Scraping completed:', request.data);
        
        chrome.action.setBadgeText({
            tabId: sender.tab.id,
            text: request.data.count.toString()
        });
        chrome.action.setBadgeBackgroundColor({
            tabId: sender.tab.id,
            color: '#27ae60'
        });
        
        setTimeout(() => {
            chrome.action.setBadgeText({
                tabId: sender.tab.id,
                text: '✓'
            });
            chrome.action.setBadgeBackgroundColor({
                tabId: sender.tab.id,
                color: '#0073b1'
            });
        }, 5000);
        
        sendResponse({success: true});
    }
});
