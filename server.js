
var express = require('express');
var app = express();
app.listen(8080, function () {
  console.log('app started');
});
var {google} = require('googleapis');
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
    scope:'https://www.googleapis.com/auth/adsense.readonly', // If you only need one scope you can pass it as string
    prompt: 'consent'    // always prompt for consent
});
var gg_accounts = {};
var db_gg_accs = firebase.database().ref('gg_accounts');
db_gg_accs.on('value', function(snapshot){
    if(snapshot.exists()) {
        gg_accounts = snapshot.val();
    }
});
setTimeout(syncAdmobReport,1000);
setInterval(syncAdmobReport,5*60*1000);
//var oauth2Client_email;
function syncAdmobReport() {
    console.info('======== syncAdmobReport ======');
    var emails = Object.keys(gg_accounts);
    for (var i=0; i<emails.length; i++){
        console.log(emails[i]);
        var token = gg_accounts[emails[i]];
        if(token!=null && token!='') {

            var adsense = google.adsense('v1.4');
            getDataReport(emails[i],token, adsense);
            function getDataReport(email, token, adsense) {
                var oauth2Client_email = new google.auth.OAuth2(
                    client_config.client_id,
                    client_config.client_secret,
                    client_config.redirect_uris[0]  // may NOT be an array. Otherwise, the consent site works, but silently fails in getToken.
                );
                oauth2Client_email.credentials = token;

                oauth2Client_email.getAccessToken(function (err, accessToken) {
                    if (!err) {
                        console.log('accessToken', accessToken);

                        adsense.accounts.list({auth: oauth2Client_email}, function (err, resp) {
                            if (err) {
                                console.log('err adsense.accounts.list', err);
                            } else {
                                if (resp.data.items != null && resp.data.items.length>0) {
                                    for (var t = 0; t < resp.data.items.length; t++) {
                                        var item = resp.data.items[t];
                                        console.log('account id = ',item.id);
                                        if (item != null) {
                                            var from_date = moment().add(-1, 'days').format('YYYY-MM-DD');
                                            var to_date = moment().add(1, 'days').format('YYYY-MM-DD');
                                            var params = {
                                                accountId: item.id,
                                                startDate: from_date,
                                                endDate: to_date,
                                                auth: oauth2Client_email,
                                                metric: ['IMPRESSIONS', 'CLICKS', 'EARNINGS'],   // https://developers.google.com/adsense/management/metrics-dimensions
                                                dimension: ['AD_UNIT_ID', 'DATE'],
                                                useTimezoneReporting: true
                                            };
                                            console.info('get report');
                                            adsense.accounts.reports.generate(params, function (errReport, resp) {
                                                if (errReport) {
                                                    console.error('adsense.accounts.reports.generate err = ', errReport);
                                                } else {
                                                    // console.log('data = ', resp.data);
                                                    var rows = resp.data.rows;
                                                    for (var r = 0; r < rows.length; r++) {
                                                        var row = rows[r];
                                                        //console.log('row = ', row);
                                                        var key = row[0].replace(':', '@');
                                                        //var ad_unit_name = row[1];
                                                        var date = row[1];
                                                        var view = parseInt(row[2]);
                                                        var click = parseInt(row[3]);
                                                        var money = parseFloat(row[4]);
                                                        /*var statistic = {
                                                            c_count: click,
                                                            v_count: view,
                                                            e_money: money,
                                                            last_update_at: moment().format('YYYY-MM-DD HH:mm:ss')
                                                        };*/
                                                        //console.log('statistic', statistic);
                                                        //firebase.database().ref('statistical/' + key + '/' + date)
                                                        //    .set(statistic);
                                                        firebase.database().ref('statistical/' + key + '/' + date+'/v_count').set(view);
                                                        firebase.database().ref('statistical/' + key + '/' + date+'/c_count').set(click);
                                                        firebase.database().ref('statistical/' + key + '/' + date+'/e_money').set(money);
                                                        firebase.database().ref('statistical/' + key + '/' + date+'/last_update_at').set(moment().format('YYYY-MM-DD HH:mm:ss'));
                                                    }
                                                }
                                            });
                                            var params2 = {
                                                accountId: item.id,
                                                startDate: from_date,
                                                endDate: to_date,
                                                auth: oauth2Client_email,
                                                metric: ['IMPRESSIONS', 'CLICKS', 'EARNINGS'],   // https://developers.google.com/adsense/management/metrics-dimensions
                                                dimension: ['AD_UNIT_ID', 'DATE', 'COUNTRY_NAME', 'AD_FORMAT_NAME'],
                                                useTimezoneReporting: true
                                            };
                                            console.log('get COUNTRY_NAME SERVED_AD_TYPE_NAME = ',params2);
                                            adsense.accounts.reports.generate(params2, function (errReport, resp) {
                                                if (errReport) {
                                                    console.error('adsense.accounts.reports.generate COUNTRY_NAME SERVED_AD_TYPE_NAME err = ', errReport);
                                                }
                                                else {
                                                    console.log('COUNTRY_NAME SERVED_AD_TYPE_NAME');
                                                    var rows = resp.data.rows;
                                                    for (var r = 0; r < rows.length; r++) {
                                                        var row = rows[r];
                                                        console.log('row = ', row);
                                                        var key = row[0].replace(':', '@');
                                                        //var ad_unit_name = row[1];
                                                        var date = row[1];
                                                        var country = row[2];
                                                        var type = row[3];
                                                        var view = parseInt(row[4]);
                                                        var click = parseInt(row[5]);
                                                        var money = parseFloat(row[6]);
                                                        var statistic = {
                                                            c_count: click,
                                                            v_count: view,
                                                            e_money: money,
                                                            last_update_at: moment().format('YYYY-MM-DD HH:mm:ss')
                                                        };
                                                        //console.log('statistic', statistic);
                                                        firebase.database().ref('statistical/' + key + '/' + date + '/analytics/' + country + '/' + type)
                                                            .set(statistic);
                                                    }
                                                }
                                            });
                                        }
                                    }
                                }
                            }
                        });

                    } else {
                        console.log('loi getAccessToken err =', err);
                    }
                });
            }
        }
    }
}
app.get('/', function(req, res) {
    console.log('request /index');
    var html='';
    var emails = Object.keys(gg_accounts);
    for(var i=0; i<emails.length; i++){
        html +='<p><a target="_blank" href="./auth/google?email='+emails[i]+'">'+emails[i]+'@gmail.com</a>: '+ JSON.stringify(gg_accounts[emails[i]]) +'</p>'
    }
    res.send(html);
});
var email_select = '';
app.get('/auth/google', function(req, res) {
    console.log('request /auth/google');
    console.log('req.query.email = ',req.query.email);
    email_select = req.query.email;// lay email trong duong dan
    res.redirect(consentURL);
});

// oauth2callback as defined in config.redirect_uris[0] in the Google Dev Console
app.get('/oauth2callback', function(req, res) {
    console.log('request /oauth2callback');
    getTokens(
        req.query.code,
        function (tokens) {
            // save tokens somewhere in a DB or a file
            if(email_select!='') {
                firebase.database().ref('gg_accounts/'+email_select).set(tokens);//.set(req.query.code);//
            }
            res.send(`Received code: ${req.query.code}<br>Tokens: ${JSON.stringify(tokens)}<br>Save them.`);
        },
        function (err, response) {
            res.send(`Received an error while trying to get tokens with code ${req.query.code}: ${err}\n${JSON.stringify(response)}`);
        }
    );
});
var tmp_token;
function getTokens(code, sucCallback, errCallback) {
    console.log('getTokens code =',code);
    oauth2Client.getToken(code, function (err, tokens, response) {
        if (!err) {
            console.log('tokens',tokens);
            // set the tokens here for future API requests
            oauth2Client.credentials = tokens;
            tmp_token = tokens;
            sucCallback(tokens);
        } else {
            errCallback(err, response);
        }
    });
}

// make sure oauth2Client's credentials are set
// with oauth2Client.setCredentials(tokens) as in getTokens
// or somewhere else with the saved tokens

app.get('/adsense', function(req, res) {
    console.log('request /adsense');
    getReport(
        function (err, reportString) {
            if (err) {
                // Send error per push notification, E-Mail etc.
                console.log('err',err);
            } else {
                // Send report per push notification, E-Mail etc.
                // send(reportString)
                console.log('reportString',reportString);
                res.send(`reportString: ${reportString}`);
            }
        });
});

function getReport(callback) {
    const adsense = google.adsense('v1.4');
    // Get a non-expired access token, after refreshing if necessary https://github.com/google/google-auth-library-nodejs/blob/master/lib/auth/oauth2client.js
    var new_oauth2Client = new google.auth.OAuth2(
        client_config.client_id,
        client_config.client_secret,
        client_config.redirect_uris[0]  // may NOT be an array. Otherwise, the consent site works, but silently fails in getToken.
    );
    new_oauth2Client.credentials = tmp_token;
    new_oauth2Client.getAccessToken(function (err, accessToken) {
        if (err) {
            callback(`getAccessToken Error: ${err}`);
            return
        }
        // create report for yesterday. Today's revenue info is still inaccurate
        const from_date = moment().add(-2, 'days').format('YYYY-MM-DD');
        const to_date = moment().format('YYYY-MM-DD');
        const params = {
            accountId: 'pub-8061268747449279',
            startDate: from_date,
            endDate: to_date,
            auth: new_oauth2Client,
            metric: ['IMPRESSIONS','CLICKS','EARNINGS'],   // https://developers.google.com/adsense/management/metrics-dimensions
            dimension: ['AD_UNIT_ID','AD_UNIT_NAME','DATE']
        };
        adsense.accounts.reports.generate(params, function (errReport, resp) {
            if (errReport) {
                callback(errReport)
            } else {
                console.log('resp = ',resp);
                callback(null, reportToString(resp))
            }
        });
    });
}

function reportToString(report) {
    const date = moment(report.endDate);
    var response = `AdMob Income for ${date.format('dddd MMM Do')}:`;
    const numRows = report.totalMatchedRows;
    const rows = report.rows;
    const currency = report.headers.find(x => x.name === 'EARNINGS').currency;
    for (var i = 0; i < numRows; i += 1) {
        // This depends on your naming convention of your Ad units
        const name = rows[i][0].split('_')[0];
        const earnings = rows[i][1];
        response += `\n${name}: ${earnings}${currency}`;
    }
    // console.log(report)
    response += `\nTotal: ${report.totals[1]}${currency}`;
    return response;
}