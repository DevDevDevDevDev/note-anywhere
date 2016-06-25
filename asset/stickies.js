
var captured = null;
var highestZ = 0;
var notes = new Array();

function getHighestZindex(){
   var highestIndex = 0;
   var currentIndex = 0;
   var elArray = Array();
   elArray = document.getElementsByTagName('*');
   for(var i=0; i < elArray.length; i++){
      if (elArray[i].currentStyle){
         currentIndex = parseFloat(elArray[i].currentStyle['zIndex']);
      }else if(window.getComputedStyle){
         currentIndex = parseFloat(document.defaultView.getComputedStyle(elArray[i],null).getPropertyValue('z-index'));
      }
      if(!isNaN(currentIndex) && currentIndex > highestIndex){ highestIndex = currentIndex; }
   }
   return(highestIndex);
}

highestZ = getHighestZindex();

function Note()
{
    var self = this;

    var note = document.createElement('div');
    note.className = 'note-anywhere';
    note.addEventListener('mousedown', function(e) { return self.onMouseDown(e) }, false);
    note.addEventListener('click', function() { return self.onNoteClick() }, false);
    this.note = note;

    var close = document.createElement('div');
    close.className = 'closebutton';
    close.addEventListener('click', function(event) { return self.close(event) }, false);
    note.appendChild(close);

    var edit = document.createElement('div');
    edit.className = 'edit';
    edit.setAttribute('contenteditable', true);
    edit.addEventListener('keyup', function() { return self.onKeyUp() }, false);
    note.appendChild(edit);
    this.editField = edit;

    var ts = document.createElement('div');
    ts.className = 'timestamp';
    ts.addEventListener('mousedown', function(e) { return self.onMouseDown(e) }, false);
    note.appendChild(ts);
    this.lastModified = ts;

    document.body.appendChild(note);
    return this;
}

Note.prototype = {
    get id()
    {
        if (!("_id" in this))
            this._id = 0;
        return this._id;
    },

    set id(x)
    {
        this._id = x;
    },

    get text()
    {
        return this.editField.innerHTML;
    },

    set text(x)
    {
        this.editField.innerHTML = x;
    },

    get timestamp()
    {
        if (!("_timestamp" in this))
            this._timestamp = 0;
        return this._timestamp;
    },

    set timestamp(x)
    {
        if (this._timestamp == x)
            return;

        this._timestamp = x;
        var date = new Date();
        date.setTime(parseFloat(x));
        this.lastModified.textContent = modifiedString(date);
    },

    get left()
    {
        return this.note.style.left;
    },

    set left(x)
    {
        this.note.style.left = x;
    },

    get top()
    {
        return this.note.style.top;
    },

    set top(x)
    {
        this.note.style.top = x;
    },

    get zIndex()
    {
        return this.note.style.zIndex;
    },

    set zIndex(x)
    {
        this.note.style.zIndex = x;
    },

    close: function(event)
    {
        this.cancelPendingSave();

        var note = this;
		chrome.extension.sendRequest({command:"close",data:{id:note.id}},function(response){console.log(response.message+response.id);});
       
        var duration = event.shiftKey ? 2 : .25;
        this.note.style.webkitTransition = '-webkit-transform ' + duration + 's ease-in, opacity ' + duration + 's ease-in';
        this.note.offsetTop; // Force style recalc
        this.note.style.webkitTransformOrigin = "0 0";
        this.note.style.webkitTransform = 'skew(30deg, 0deg) scale(0)';
        this.note.style.opacity = '0';
		notes.splice(notes.indexOf(note.id), 1);
		chrome.extension.sendRequest({command:"updateCount",data:notes.length});

        var self = this;
        setTimeout(function() { document.body.removeChild(self.note) }, duration * 1000);
    },

    saveSoon: function()
    {
        this.cancelPendingSave();
        var self = this;
        this._saveTimer = setTimeout(function() { self.save() }, 200);
    },

    cancelPendingSave: function()
    {
        if (!("_saveTimer" in this))
            return;
        clearTimeout(this._saveTimer);
        delete this._saveTimer;
    },

    save: function()
    {
        this.cancelPendingSave();

        if ("dirty" in this) {
            this.timestamp = new Date().getTime();
            delete this.dirty;
        }

        var note = this;
		chrome.extension.sendRequest({command:"save",data:{id:note.id, text:note.text, timestamp:note.timestamp, left:note.left, top:note.top, zindex:note.zIndex, url:window.location.href}},function(response){console.log(response.message+response.id);});

    },

    saveAsNew: function()
    {
        this.timestamp = new Date().getTime();
        
        var note = this;
		chrome.extension.sendRequest({command:"saveAsNew",data:{id:note.id, text:note.text, timestamp:note.timestamp, left:note.left, top:note.top, zindex:note.zIndex, url:window.location.href}},function(response){console.log(response.message+response.id);});

    },

    onMouseDown: function(e)
    {
        captured = this;
        this.startX = e.clientX - this.note.offsetLeft;
        this.startY = e.clientY - this.note.offsetTop;
        this.zIndex = ++highestZ;

        var self = this;
        if (!("mouseMoveHandler" in this)) {
            this.mouseMoveHandler = function(e) { return self.onMouseMove(e) }
            this.mouseUpHandler = function(e) { return self.onMouseUp(e) }
        }

        document.addEventListener('mousemove', this.mouseMoveHandler, true);
        document.addEventListener('mouseup', this.mouseUpHandler, true);

        return false;
    },

    onMouseMove: function(e)
    {
        if (this != captured)
            return true;

        this.left = e.clientX - this.startX + 'px';
        this.top = e.clientY - this.startY + 'px';
        return false;
    },

    onMouseUp: function(e)
    {
        document.removeEventListener('mousemove', this.mouseMoveHandler, true);
        document.removeEventListener('mouseup', this.mouseUpHandler, true);

        this.save();
        return false;
    },

    onNoteClick: function(e)
    {
        this.editField.focus();
        getSelection().collapseToEnd();
    },

    onKeyUp: function()
    {
        this.dirty = true;
        this.saveSoon();
    },
}


function loadNotes(data)
{
	data = eval(data);
	for (var i = 0; i < data.length; ++i) {
		var row = data[i];
		if(notes.indexOf(row.id) == -1){
			var note = new Note();
			note.id = row.id;
			note.text = row.note;
			note.timestamp = row.timestamp;
			note.left = row.left;
			note.top = row.top;
			note.zIndex = row.zindex;
			if(note.zIndex == ''){
				note.zIndex = highestZ;
			}

			if (row.zindex > highestZ)
				highestZ = row['zindex'];
			notes[notes.length] = note.id;
		}
	}
}

function modifiedString(date)
{
    return  date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate() + ' ' + date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds();
}

function newNote(id)
{
    var note = new Note();
    note.id = id;
    note.timestamp = new Date().getTime();
    note.left = (window.pageXOffset + Math.round(Math.random() * (window.innerWidth - 150))) + 'px';
    note.top = (window.pageYOffset + Math.round(Math.random() * (window.innerHeight - 200))) + 'px';
    note.zIndex = ++highestZ;
    note.saveAsNew();
	notes[notes.length] = note.id;
	chrome.extension.sendRequest({command:"updateCount",data:notes.length});
	note.editField.focus();
}
function applyCSS(localstorage){
	var newline=unescape("%"+"0A");
	var deleteButton = chrome.extension.getURL("asset/deleteButton.png");
	if(document.getElementById('noteanywherecss') == null){
		var headID = document.getElementsByTagName("head")[0];         
		var cssNode = document.createElement('link');
		cssNode.setAttribute('id','noteanywherecss');
		cssNode.media = 'screen';
		cssNode.type = 'text/css';
		cssNode.rel = 'stylesheet';
		headID.appendChild(cssNode);
	}
	css = '.note-anywhere .closebutton{background-image: url('+deleteButton+');}' + newline;
	
	if(localstorage != undefined){
		if(localstorage['bg_color'] != undefined)
			css += '.note-anywhere {background-color: #'+localstorage['bg_color']+';}'+ newline;
		if(localstorage['t_color'] != undefined)
			css += '.note-anywhere {color: #'+localstorage['t_color']+';}'+ newline;
		if(localstorage['font'] != undefined)
			css += '.note-anywhere  .edit {font-family: '+localstorage['font']+';}' +newline;
		if(localstorage['font_size'] != undefined)
			css += '.note-anywhere  .edit {font-size: '+localstorage['font_size']+';}' +  newline;
		if(localstorage['bb_color'] != undefined)
			css += '.note-anywhere .timestamp {background-color: #'+ localstorage['bb_color'] +';}'+ newline;
		if(localstorage['bt_color'] != undefined)
			css += '.note-anywhere .timestamp {color: #'+ localstorage['bt_color'] +';}';
	}
	document.getElementById('noteanywherecss').href = 'data:text/css,'+escape(css);
	
}

function loadCSS(json){
	localstorage = eval(json);
	applyCSS(localstorage);
}

applyCSS();

