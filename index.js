#!/usr/bin/env node

const cliProgress = require("cli-progress")
const axios = require('axios')
const fs = require('fs')
const _colors = require('colors');
const program = require('commander')

var adapose = false;

function subdomain_from_galleryid(g, number_of_frontends) {
    if (adapose) {
        return '0';
    }

    var o = g % number_of_frontends;

    return String.fromCharCode(97 + o);
}

function subdomain_from_url(url, base) {
    var retval = 'a';
    if (base) {
        retval = base;
    }

    var number_of_frontends = 3;
    var b = 16;

    var r = /\/[0-9a-f]\/([0-9a-f]{2})\//;
    var m = r.exec(url);
    if (!m) {
        return retval;
    }

    var g = parseInt(m[1], b);
    if (!isNaN(g)) {
        if (g < 0x30) {
            number_of_frontends = 2;
        }
        if (g < 0x09) {
            g = 1;
        }
        retval = subdomain_from_galleryid(g, number_of_frontends) + retval;
    }

    return retval;
}

function url_from_url(url, base) {
    return url.replace(/\/\/..?\.hitomi\.la\//, '//' + subdomain_from_url(url, base) + '.hitomi.la/'); //edit
}


function full_path_from_hash(hash) {
    if (hash.length < 3) {
        return hash;
    }
    return hash.replace(/^.*(..)(.)$/, '$2/$1/' + hash);
}


function url_from_hash(galleryid, image, dir, ext) {
    ext = ext || dir || image.name.split('.').pop();
    dir = dir || 'images';

    return 'https://a.hitomi.la/' + dir + '/' + full_path_from_hash(image.hash) + '.' + ext; //edit
}

function url_from_url_from_hash(galleryid, image, dir, ext, base) {
    return url_from_url(url_from_hash(galleryid, image, dir, ext), base);
}

function makeDir(id) {
    "use strict"
    const dir = `./images/${id}`;
    
    fs.readdir(`images`, (err) => {
        if (err) {
            console.error('다운로드 폴더를 현재 경로에 생성합니다.');
            fs.mkdirSync(`images`);
        }
    });

    fs.readdir(dir, err => {
        if (err) {
            fs.mkdirSync(dir);
        }
    });

    return dir
}

async function getInfo(id) {
    "use strict"
    try {
    const galleryinfo = await axios.get(`https://ltn.hitomi.la/galleries/${id}.js`)
    .then(({data}) => data)        
    .catch(err => {
        if (err.response) {
            if (err.response.status == 404) throw new Error("Not found")
        }
        if (err.request) throw new Error("VPN을 사용하세요") 
    })
        await (new Function(galleryinfo.replace("var galleryinfo", "json")))();
        return json
    } catch(e) {
        console.error(e)
    }
};

function checkFiles(files, dir) {
    "use strict"
    let nonexistent = [];

    files.map(file => {
        if (!fs.existsSync(`${dir}/${file["name"]}`)) {
            nonexistent.push(file)
        }
    })

    if (!nonexistent.length) {
        console.log("already completely downloaded")
        process.exit(0)
    }
    return nonexistent
}

function imageRequest(url, id) {
    "use strict"
    return axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.132 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            "Accept-Encoding": "gzip, deflate, br",
            'Referer': `https://hitomi.la/reader/${id}.html`,
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Cache-Control': 'max-age=0',
            'TE': 'Trailers'
        },
        responseType: 'arraybuffer'
    }).catch(() => imageRequest(url, id)) //recursive function
}

function imgDownload(nonexistent, files, id, dir) {
    "use strict"
    const bar = new cliProgress.Bar({
        format: `${_colors.green('Downloading... {bar}')} | {percentage}% | ETA: {eta}s | {value}/{total} |`,
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2590',
    })

    bar.start(nonexistent.length, 0)

    const timeStart = new Date()

    Promise.all(nonexistent.map(async file => {
        try {
            let url = await url_from_url_from_hash(id, file)
            let res = await imageRequest(url, id)

            fs.writeFile(`${dir}/${file["name"]}`, res.data, err => {
                if (err) {
                    console.error(err)
                }
                    fs.readdir(dir, (err, readFiles) => {
                    if (err) {
                        console.error(err)
                    }

                    if (nonexistent.length == files.length) {
                        bar.update(readFiles.length)
                    } 

                    bar.update(readFiles.length - (files.length - nonexistent.length))
                    
                    if (files.length == readFiles.length) {
                        const timeEnd = new Date()
                        console.log(`\nDownload Complete\nelapsed time : ${((timeEnd - timeStart) / 1000).toFixed(2)}s`)
                        process.exit(0)
                    }
                });    
            })
        } catch(e) {
            console.error(e)
        }
    }))
}

async function download(id) {
    "use strict"
    try {
        const dir = makeDir(id)
        const json = await getInfo(id);

        const { title, language, type, files } = json;
        const { length } = json.files;

        console.log(`title : ${title}\ntype : ${type}\nlanguage : ${language}\nid : ${id}\nlength : ${length}`);

        let nonexistent = checkFiles(files, dir);

        return imgDownload(nonexistent, files, id, dir);

    } catch(e) {
        console.error(e)
    }
}

program
    .version('1.0.1', '-v, --version')
    .usage('galleryId')
program
    .command('download <galleryId>')
    .description("A simple hitomi downloader written in javascript")
    .action(id => download(id))

program
    .command('*', {
        noHelp: true
    })
    .action(() => {
        console.log("Cannot find command")
    })

program
    .parse(process.argv)
