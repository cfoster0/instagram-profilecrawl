
const wdio = require('wdio');
const selenium = require('selenium-standalone');
const ora = require('ora');
const chalk = require('chalk');
const _ = require('lodash');
const utils = require('./utils');

const spinnerCrawl = ora('Init crawl!');
const options = {
    desiredCapabilities: {
        browserName: 'chrome',
    },
};
const browser = wdio.getBrowser(options);
let listProfileName = [];

module.exports = {
    start(listName) {
        spinnerCrawl.start();
        listProfileName = listName;
        selenium.start((err) => {
            if (err) {
                return spinnerCrawl.fail(chalk.red('Unable to start selenium server!'));
            }
            return initBrowser();
        });
    },
};

function initBrowser() {
    wdio.run(initCrawlProfile, (err) => {
        if (err) {
            spinnerCrawl.fail(chalk.red(err.message));
        }
        while (listProfileName.length) {
            loadProfile();
        }
        browser.end();
        process.exit();
    });
}

// init crawl of profile
function initCrawlProfile() {
    browser.init();
    return loadProfile();
}

// load profile
function loadProfile() {
    this.profileName = listProfileName.shift();
    browser.url(`https://instagram.com/${this.profileName}`);

    // check if profile exist
    if (browser.isExisting('div.error-container')) {
        return spinnerCrawl.fail(chalk.red(`Profile ${this.profileName} doesn't exist!`));
    }

    spinnerCrawl.succeed(chalk.green(`Profile successfully loaded for ${this.profileName}!`));
    spinnerCrawl.text = 'Begin of the first step!';
    spinnerCrawl.start();

    this.dataProfile = {
        alias: getValue('h1'),
        username: getValue('h2._79dar'),
        descriptionProfile: getValue('._bugdy span'),
        urlProfile: browser.getUrl(),
        urlImgProfile: getValue('._o0ohn img', 'src'),
        website: getValue('a._56pjv'),
        numberPosts: utils.cleanNumber(getValue('ul._9o0bc li:first-child ._bkw5z')),
        numberFollowers: utils.cleanNumber(getValue('ul._9o0bc li:nth-child(2) ._bkw5z')),
        numberFollowing: utils.cleanNumber(getValue('ul._9o0bc li:nth-child(3) ._bkw5z')),
        private: browser.isVisible('h2._glq0k'),
        posts: [],
    };

    if (this.dataProfile.private === true || this.dataProfile.numberPosts === 0) {
        return utils.createFile(this.dataProfile);
    }

    if (browser.isExisting('a._8imhp')) {
        browser.pause(400);
        browser.click('a._8imhp');
    }

    return extractUrlPostProfile();
}

// get all url in profile
function extractUrlPostProfile() {
    const self = this;
    let i = 1;
    let j = 1;

    if (browser.isExisting('a._8imhp')) {
        browser.click('a._8imhp');
    }

    function moveToObject() {
        if (self.dataProfile.posts.length === self.dataProfile.numberPosts) {
            this.urls = getValue('._nljxa a', 'href');
            if (!_.isArray(this.urls)) {
                this.urls = [this.urls];
            }
            spinnerCrawl.succeed(chalk.green('End of the first step!'));
            return browsePosts();
        }
        const item = `._nljxa ._myci9:nth-child(${i}) a:nth-child(${j})`;
        while (!browser.isVisible(item)) {
            browser.pause(100);
        }
        browser.moveToObject(item);
        let numberLikes = getValue(`${item} li._sjq6j span:first-child`);
        let numberViews = getValue(`${item} li._9ym92 span:first-child`);
        while (!numberLikes && !numberViews) {
            browser.pause(100);
            numberLikes = getValue(`${item} li._sjq6j span:first-child`);
            numberViews = getValue(`${item} li._qq2if span:first-child`);
        }
        const post = {
            url: getValue(item, 'href'),
            urlImage: getValue(`${item} img`, 'src'),
            numberLikes: utils.cleanNumber(numberLikes),
            numberViews: utils.cleanNumber(numberViews),
            numberComments: utils.cleanNumber(getValue(`${item} li._qq2if span:first-child`)),
            isVideo: browser.isVisible(`${item} span.coreSpriteVideoIconLarge`),
            multipleImage: browser.isVisible(`${item} span.coreSpriteSidecarIconLarge`),
            tags: [],
            mentions: [],
        };

        const description = getValue(`${item} img`, 'alt');
        if (description && _.isString(description)) {
            post.description = description.trim();
            post.tags = utils.getTags(description);
            post.mentions = utils.getMentions(description);
        } else {
            post.description = '';
        }

        if (j === 3) {
            j = 1;
            i++;
        } else {
            j++;
        }

        self.dataProfile.posts.push(post);
        spinnerCrawl.text = `Advancement of the first step : ${self.dataProfile.posts.length}/${self.dataProfile.numberPosts}`;

        return moveToObject();
    }

    browser.pause(1000);
    browser.moveToObject('img._iv4d5');
    moveToObject();
}

// browse each post
function browsePosts() {
    spinnerCrawl.start();

    const numberPost = this.dataProfile.numberPosts;
    let number = 0;
    while (this.urls.length > 0) {
        // access url
        browser.url(this.urls.shift());
        const post = _.find(this.dataProfile.posts, {
            url: `${browser.getUrl()}?taken-by=${this.dataProfile.alias}`,
        });
        post.localization = getValue('a._kul9p', 'title');
        post.date = utils.getDate(getValue('time', 'title'));

        // get different url if post is video or image
        if (post.isVideo) {
            post.urlVideo = getValue('video', 'src');
        }

        // get multiple image if exist
        if (post.multipleImage) {
            post.urlImage = [post.urlImage];
            while (browser.isExisting('a.coreSpriteRightChevron')) {
                browser.click('a.coreSpriteRightChevron');
                let image = getValue('img._icyx7', 'src');
                let video = getValue('video', 'src');
                while (!image && !video) {
                    browser.pause(100);
                    image = getValue('img._icyx7', 'src');
                    video = getValue('video', 'src');
                }
                if (browser.isVisible('video')) {
                    if (post.urlVideo) {
                        post.urlVideo = [post.urlVideo];
                    } else {
                        post.urlVideo = [];
                    }
                    post.urlVideo.push(video);
                } else {
                    post.urlImage.push(image);
                }
            }
        }

        // get precise number likes
        const numberLikes = utils.cleanNumber(getValue('span._tf9x3'));
        if (post.numberLikes > 11 && numberLikes > post.numberLikes) {
            post.numberLikes = numberLikes;
        }

        // get number view for video
        if (browser.isVisible('span._9jphp span') && post.numberViews > 0) {
            post.numberViews = utils.cleanNumber(getValue('span._9jphp span'));
            delete post.numberLikes;
        } else {
            delete post.numberViews;
        }

        // get mentions in image
        let mentionsImage = getValue('a._ofpcv', 'href');
        if (mentionsImage) {
            if (_.isArray(mentionsImage)) {
                mentionsImage = mentionsImage.join(',')
                    .replace(/https:\/\/www.instagram.com\//g, '@')
                    .replace(/\//g, '')
                    .split(',');
                post.mentions = post.mentions.concat(mentionsImage);
            } else {
                mentionsImage = mentionsImage.replace(/https:\/\/www.instagram.com\//g, '@').replace(/\//g, '');
                post.mentions.push(mentionsImage);
            }
        }
        number++;
        spinnerCrawl.text = `Advancement of second step : ${number}/${numberPost}`;
    }

    return utils.createFile(this.dataProfile)
        .then(() => spinnerCrawl.succeed(chalk.green('File created with success!')))
        .catch(err => spinnerCrawl.fail(chalk.red(`Error : ${err.message}`)));
}

// catch error
function getValue(element, attribute) {
    const isExisting = browser.isExisting(element);

    if (isExisting) {
        if (attribute) {
            return browser.getAttribute(element, attribute);
        }
        return browser.getText(element);
    }

    return null;
}
