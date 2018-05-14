
var express = require('express');
var app = express();
app.listen(80, function () {
  console.log('app started');
});
var google = require('googleapis');
var serviceAccount = require('./vietnam-travel-tips-firebase-adminsdk-krq6z-7ae80a5c03.json');
var firebase = require('firebase-admin');
var moment = require('moment');
var config = require('./config.json');
//console.log('config',config);
firebase.initializeApp({
  credential: firebase.credential.cert(serviceAccount),
  databaseURL: "https://vietnam-travel-tips.firebaseio.com"
});

const client_config = require('./client_secret.json').web;

const oauth2Client = new google.auth.OAuth2(
    client_config.client_id,
    client_config.client_secret,
    client_config.redirect_uris[0]  // may NOT be an array. Otherwise, the consent site works, but silently fails in getToken.
);

const consentURL = oauth2Client.generateAuthUrl({
    access_type: 'offline', // 'online' (default) or 'offline' (gets refresh_token)
    'https://www.googleapis.com/auth/adsense.readonly',  // If you only need one scope you can pass it as string
    prompt: 'consent'    // always prompt for consent
});

app.get('/auth/google', function(req, res) {
    res.redirect(consentURL);
});

// oauth2callback as defined in config.redirect_uris[0] in the Google Dev Console
app.get('/oauth2callback', function(req, res) {
    getTokens(req.query.code,
        function (tokens) {
            // save tokens somewhere in a DB or a file
            res.send(`Received code: ${req.query.code}<br>Tokens: ${JSON.stringify(tokens)}<br>Save them.`);
        },
        function (err, response) {
            res.send(`Received an error while trying to get tokens with code ${req.query.code}: ${err}\n${JSON.stringify(response)}`);
        }
    );
});

function getTokens(code, sucCallback, errCallback) {
    oauth2Client.getToken(code, function (err, tokens, response) {
        if (!err) {
            // set the tokens here for future API requests
            oauth2Client.setCredentials(tokens);
            sucCallback(tokens);
        } else {
            errCallback(err, response);
        }
    })
}

// make sure oauth2Client's credentials are set
// with oauth2Client.setCredentials(tokens) as in getTokens
// or somewhere else with the saved tokens

app.get('/adsense', function(req, res) {
    getLatestReport(
function(err, reportString) {
    if (err) {
        // Send error per push notification, E-Mail etc.
    } else {
        // Send report per push notification, E-Mail etc.
        // send(reportString)
    }
})
})

function getLatestReport(callback) {
    const adsense = google.adsense('v1.4');
    // Get a non-expired access token, after refreshing if necessary https://github.com/google/google-auth-library-nodejs/blob/master/lib/auth/oauth2client.js
    oauth2Client.getAccessToken(function (err, accessToken) {
        if (err) {
            callback(`getAccessToken Error: ${err}`)
            return
        }
        // create report for yesterday. Today's revenue info is still inaccurate
        const date = moment().add(-1, 'days').format('YYYY-MM-DD');
        const params = {
            accountId: 'pub-58**************',
            startDate: date,
            endDate: date,
            auth: oauth2Client,
            metric: 'EARNINGS',   // https://developers.google.com/adsense/management/metrics-dimensions
            dimension: 'AD_UNIT_NAME',
        };
        adsense.accounts.reports.generate(params, function (errReport, resp) {
            if (errReport) {
                callback(errReport)
            } else {
                callback(null, reportToString(resp))
            }
        });
    });
}

function reportToString(report) {
    const date = moment(report.endDate);
    let response = `AdMob Income for ${date.format('dddd MMM Do')}:`;
    const numRows = report.totalMatchedRows;
    const rows = report.rows;
    const currency = report.headers.find(x => x.name === 'EARNINGS').currency;
    for (let i = 0; i < numRows; i += 1) {
        // This depends on your naming convention of your Ad units
        const name = rows[i][0].split('_')[0];
        const earnings = rows[i][1];
        response += `\n${name}: ${earnings}${currency}`;
    }
    // console.log(report)
    response += `\nTotal: ${report.totals[1]}${currency}`;
    return response;
}