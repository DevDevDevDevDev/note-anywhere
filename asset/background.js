var db;
var notes;
var highestId = 0;
//var skipUrls = ['chrome://extensions/','chrome://newtab/','chrome://devtools/devtools.html'];

try {
    if (window.openDatabase) {
        db = openDatabase("NoteAnyWhereV1", "1.0", "Note AnyWeb AnyWhere", 2000000);
        if (!db)
            alert("Failed to open the database on disk.  This is probably because the version was bad or there is not enough space left in this domain's quota");
        else {
            db.transaction(function (tx) {
                tx.executeSql('CREATE TABLE IF NOT EXISTS WebKitStickyNotes (id REAL UNIQUE, note TEXT, timestamp REAL, left TEXT, top TEXT, zindex REAL, host TEXT)',
                    []);
            });
        }
    } else
        alert("Couldn't open the database.  Please try with a WebKit nightly with this feature enabled");
} catch (err) {
}

function skipUrl(url, notify) {
    if ((url.indexOf('http://') != 0 && url.indexOf('https://') != 0 ) || url.indexOf('https://chrome.google.com/') == 0) {
        if (notify)    alert('Google Chrome has restrict to use plugin in this page!');
        return true;
    } else
        return false;
}


function findHighestId() {
    db.transaction(function (tx) {
        tx.executeSql("SELECT id FROM WebKitStickyNotes", [],
            function (tx, result) {
                for (var i = 0; i < result.rows.length; ++i) {
                    var row = result.rows.item(i);
                    if (row['id'] > highestId)
                        highestId = row['id'];
                }
            },
            function (tx, error) {
                console.log('Failed to retrieve notes from database - ' + error.message);
                return;
            }
        );
    });
}

findHighestId(); //let's find the highest Id

chrome.browserAction.setBadgeText({text: ""});
chrome.browserAction.onClicked.addListener(function (tab) {
    if (!skipUrl(tab.url, true))
        newNote();
});

chrome.tabs.onCreated.addListener(function (tab) {
    if (!skipUrl(tab.url)) {
        loadCSS();
        loadNotes();
    }
    updateCount(tab);
});

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    if (!skipUrl(tab.url)) {
        loadCSS();
        loadNotes();
    }
    updateCount(tab);
});

function updateCount(tab, count) {
    if (count != undefined) {
        notes = count;
    } else if (skipUrl(tab.url)) {
        notes = '';
    } else {
        db.transaction(function (tx) {
            var host = new URL(tab.url).host;
            tx.executeSql("SELECT * FROM WebKitStickyNotes WHERE host = ?", [host], function (tx, result) {
                notes = result.rows.length;
            })
        });
    }
    chrome.browserAction.setBadgeText({text: "" + (notes || 0), tabId: tab.id});
}

var newNote = function () {
    id = ++highestId;
    code = 'newNote(' + id + ')';
    chrome.tabs.getSelected(null, function (tab) {
        chrome.tabs.executeScript(tab.id, {code: code});
    });
};

var loadNotes = function () {
    chrome.tabs.getSelected(null, function (tab) {
        var url = new URL(tab.url);
        var host = url.host;
        db.transaction(function (tx) {
            tx.executeSql("SELECT * FROM WebKitStickyNotes WHERE host = ?", [host], function (tx, result) {
                var data = [];
                for (var i = 0; i < result.rows.length; ++i) {
                    data[i] = result.rows.item(i);
                }
                code = 'loadNotes(' + JSON.stringify(data) + ')';
                chrome.tabs.executeScript(tab.id, {code: code});
            }, function (tx, error) {
                console.log('Failed to retrieve notes from database - ' + error.message);
                return;
            });
        });
    });
}


var loadCSS = function () {
    code = 'loadCSS(' + JSON.stringify(localStorage) + ')';
    chrome.tabs.getSelected(null, function (tab) {
        chrome.tabs.executeScript(tab.id, {code: code});
    });
}

var execute = function (code) {
    chrome.tabs.getSelected(null, function (tab) {
        if (!skipUrl(tab.url))
            chrome.tabs.executeScript(tab.id, {code: code});
    });
};

chrome.extension.onRequest.addListener(
    function (request, sender, sendResponse) {
        if (request.command == 'save') {
            note = request.data;
            var host = new URL(note.url).host;

            db.transaction(function (tx) {
                tx.executeSql("UPDATE WebKitStickyNotes SET note = ?, timestamp = ?, left = ?, top = ?, zindex = ?, host = ? WHERE id = ?", [note.text, note.timestamp, note.left, note.top, note.zindex, host, note.id]);
            });
            sendResponse({message: "Saved", id: request.data.id});
        } else if (request.command == 'saveAsNew') {
            note = request.data;
            db.transaction(function (tx) {
                tx.executeSql("INSERT INTO WebKitStickyNotes (id, note, timestamp, left, top, zindex, host) VALUES (?, ?, ?, ?, ?, ?,?)", [note.id, note.text, note.timestamp, note.left, note.top, note.zindex, host]);
            });
            sendResponse({message: "SavedNew", id: request.data.id});
        } else if (request.command == 'close') {
            db.transaction(function (tx) {
                tx.executeSql("DELETE FROM WebKitStickyNotes WHERE id = ?", [request.data.id]);
            });
            sendResponse({message: "Deleted", id: request.data.id});
        } else if (request.command == 'updateCount') {
            chrome.tabs.getSelected(null, function (tab) {
                updateCount(tab, request.data);
            });
        } else if (request.command == 'summary') {
            getSummary(request.data.page);
            window.notesumtimer = setInterval(function () {
                if (window.notesum !== null) {
                    sendResponse({message: "Summary", summary: window.notesum});
                    window.clearInterval(window.notesumtimer);
                }
            }, 2);

        }
    }
);

function getSummary(page) {
    if (!page) page = 1;
    start = (page - 1) * 12;
    window.notesum = null;
    db.transaction(function (tx) {
        tx.executeSql("SELECT count(*) as c ,host FROM WebKitStickyNotes GROUP BY host ORDER BY c DESC,id LIMIT " + start + ",13", [], function (tx, result) {
            window.notesum = new Array();
            for (var i = 0; i < result.rows.length; ++i) {
                window.notesum[i] = {count: result.rows.item(i).c || 0, host: result.rows.item(i).host};
            }
        })
    }, function (tx, error) {
        console.log('Failed to retrieve notes from database - ' + error.message);
        window.notesum = false;
    });
}