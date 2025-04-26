import puppeteer from "puppeteer";

/**
 * Extract and log text representation of Amazon search results
 * Navigates through multiple pages and scrapes a set amount of times
 * With anti-detection measures and error handling
 */
(async () => {
  try {
    console.log('Starting Amazon search scraper...');
    
    const MAX_PAGES = 3; // the maximum number of pages to scrape
    const SEARCH_QUERY = "laptop"; 
    const MIN_DELAY = 2000;
    const MAX_DELAY = 5000;
    
    // Array of user agents to rotate
    const USER_AGENTS = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.71 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.2 Safari/605.1.15',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:96.0) Gecko/20100101 Firefox/96.0'
    ];
    
    const randomDelay = async (min = MIN_DELAY, max = MAX_DELAY) => {
      const delay = Math.floor(Math.random() * (max - min + 1)) + min;
      console.log(`Waiting for ${delay/1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    };
    

    const getRandomUserAgent = () => {
      return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    };
    

    const browser = await puppeteer.launch({
      headless: true,
      defaultViewport: null, 
      args: [
        '--window-size=1920,1080',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });
    
    const page = await browser.newPage();
    

    const userAgent = getRandomUserAgent();
    await page.setUserAgent(userAgent);
    console.log(`Using user agent: ${userAgent}`);
    
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br'
    });
    

    await browser.setCookie({
      name: 'session-id',
      value: `${Date.now()}`,
      domain: '.amazon.com'
    });
    

    let allProducts = [];
    
    const extractProductsFromPage = async () => {
      const pageProducts = await page.evaluate(() => {
        // Get all product cards that are actual products (not sponsored or other elements)
        const productCards = Array.from(document.querySelectorAll('.s-result-item[data-asin]:not([data-asin=""])'))
        
        return productCards.map((card, index) => {
          const titleElement = card.querySelector('h2 span');
          const title = titleElement ? titleElement.textContent.trim() : 'No title found';
          
          const wholePriceElement = card.querySelector('.a-price-whole');
          const fractionPriceElement = card.querySelector('.a-price-fraction');
          const priceSymbolElement = card.querySelector('.a-price-symbol');
          
          let price = 'No featured offers/Item not available';
          let currencySymbol = '';
          if (wholePriceElement) {
            const whole = wholePriceElement.textContent.trim();
            const fraction = fractionPriceElement ? fractionPriceElement.textContent.trim() : '';
            const symbol = priceSymbolElement ? priceSymbolElement.textContent.trim() : '$';
            currencySymbol = symbol;
            price = Number(`${whole}${fraction ? fraction : ''}`);
          }
          
          const ratingElement = card.querySelector('.a-icon-star-small');
          const rating = ratingElement ? Number(ratingElement.textContent.trim().replace('out of 5 stars', '')) : 'No rating found';
          
          const reviewCountElement = card.querySelector('.a-size-base.s-underline-text');
          const reviewCount = reviewCountElement ? Number(reviewCountElement.textContent.trim().replace(',', '')) : 'No reviews found';
          
          const linkElement = card.querySelector('.a-link-normal');
          const url = linkElement ? linkElement.getAttribute('href') : '';
          const fullUrl = url ? `https://www.amazon.com${url.startsWith('/') ? url : '/' + url}` : '';
          
          const asin = card.getAttribute('data-asin') || 'Unknown';
          
          return {
            asin,
            title,
            currencySymbol,
            price,
            rating,
            reviewCount,
            url: fullUrl
          };
        }).filter(item => item.title !== 'No title found');
      });
      
      return pageProducts;
    };
    
    const hasNextPage = async () => {
      return await page.evaluate(() => {
        const nextButton = document.querySelector('.s-pagination-next:not(.s-pagination-disabled)');
        return !!nextButton;
      });
    };
    
    const goToNextPage = async () => {
      try {
        await randomDelay(1000, 2000);
        
        await page.waitForSelector('.s-pagination-next:not(.s-pagination-disabled)', {
          visible: true,
          timeout: 10000
        });
        
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }),
          page.click('.s-pagination-next')
        ]);
        
        await randomDelay();
        
        await page.evaluate(async () => {
          await new Promise((resolve) => {
            let totalHeight = 0;
            const distance = 100;
            const timer = setInterval(() => {
              const scrollHeight = document.body.scrollHeight;
              window.scrollBy(0, distance);
              totalHeight += distance;
              
              if (totalHeight >= scrollHeight) {
                clearInterval(timer);
                resolve();
              }
            }, 100);
          });
        });
        
        await page.evaluate(() => {
          window.scrollTo(0, 0);
        });
        
        return true;
      } catch (error) {
        console.error(`Navigation error: ${error.message}`);
        return false;
      }
    };
    
    console.log(`Navigating to Amazon search page for "${SEARCH_QUERY}"...`);
    
    try {
      await page.goto(`https://www.amazon.com/s?k=${encodeURIComponent(SEARCH_QUERY)}`, { 
        waitUntil: 'networkidle2',
        timeout: 60000 
      });
      
      await randomDelay();
      
      await page.evaluate(async () => {
        await new Promise((resolve) => {
          let totalHeight = 0;
          const distance = 100;
          const timer = setInterval(() => {
            const scrollHeight = document.body.scrollHeight;
            window.scrollBy(0, distance);
            totalHeight += distance;
            
            if (totalHeight >= scrollHeight) {
              clearInterval(timer);
              resolve();
            }
          }, 100);
        });
      });
      
      await page.evaluate(() => {
        window.scrollTo(0, 0);
      });
      
    } catch (error) {
      console.error(`Error navigating to search page: ${error.message}`);
      throw error;
    }
    
    let currentPage = 1;
    let hasMorePages = true;
    
    while (currentPage <= MAX_PAGES && hasMorePages) {
      try {
        await page.waitForSelector('.s-result-item', { timeout: 15000 });
        console.log(`Page ${currentPage} loaded successfully`);
        
        await page.screenshot({ path: `amazon-page-${currentPage}.png` });
        
        console.log(`Extracting search results from page ${currentPage}...`);
        const productsOnCurrentPage = await extractProductsFromPage();
        console.log(`Found ${productsOnCurrentPage.length} products on page ${currentPage}`);
        
        if (productsOnCurrentPage.length > 0) {
          const productsWithPageNumber = productsOnCurrentPage.map((product, index) => ({
            ...product,
            page: currentPage,
            index: index + 1
          }));
          
          allProducts = [...allProducts, ...productsWithPageNumber];
        } else {
          console.log(`No products found on page ${currentPage}, might be blocked or reached the end`);
          hasMorePages = false;
          break;
        }
        
        if (currentPage >= MAX_PAGES) {
          console.log(`Reached maximum number of pages (${MAX_PAGES})`);
          break;
        }
        
        const nextPageExists = await hasNextPage();
        if (!nextPageExists) {
          console.log('No more pages available');
          hasMorePages = false;
          break;
        }
        
        console.log(`Navigating to page ${currentPage + 1}...`);
        const navigationSuccessful = await goToNextPage();
        
        if (!navigationSuccessful) {
          console.log('Failed to navigate to the next page, stopping pagination');
          hasMorePages = false;
          break;
        }
        
        await randomDelay(MIN_DELAY, MAX_DELAY);
        
        currentPage++;
        
      } catch (error) {
        console.error(`Error processing page ${currentPage}: ${error.message}`);
        console.log('Continuing with data collected so far...');
        hasMorePages = false;
        break;
      }
    }
    
    allProducts = allProducts.map((product, index) => ({
      ...product,
      globalIndex: index + 1
    }));
    
    console.log('\n=== SCRAPING SUMMARY ===');
    console.log(`Total products scraped: ${allProducts.length}`);
    
    const fs = await import('fs');
    fs.writeFileSync('amazon-search-results.json', JSON.stringify(allProducts, null, 2));
    console.log('\nSearch results saved to amazon-search-results.json');
    
    let textOutput = `AMAZON ${SEARCH_QUERY.toUpperCase()} SEARCH RESULTS\n`;
    textOutput += '='.repeat(80) + '\n\n';
    textOutput += `Total products found: ${allProducts.length} across ${Math.min(MAX_PAGES, allProducts.length > 0 ? allProducts[allProducts.length - 1].page : 0)} pages\n\n`;
    
    allProducts.forEach(product => {
      textOutput += `Product #${product.globalIndex} (Page ${product.page}, Item ${product.index})\n`;
      textOutput += '-'.repeat(80) + '\n';
      textOutput += `ASIN: ${product.asin}\n`;
      textOutput += `Title: ${product.title}\n`;
      textOutput += `Price: ${product.currencySymbol}${product.price}\n`;
      textOutput += `Rating: ${product.rating} out of 5 stars\n`;
      textOutput += `Reviews: ${product.reviewCount}\n`;
      textOutput += `URL: ${product.url}\n\n`;
    });
    
    fs.writeFileSync('amazon-search-results.txt', textOutput);
    console.log('Search results saved to amazon-search-results.txt');
    
    await browser.close();
    console.log('Browser closed.');
    
  } catch (error) {
    console.error('An error occurred:', error);
    console.error(error.stack);
  }
})();
