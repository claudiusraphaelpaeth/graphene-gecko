
var	gText = "";
var	gSites = "";



function loadPage()
{
	try
	{
		var rdf = Components.classes["component://netscape/rdf/rdf-service"].getService();
		if (rdf)   rdf = rdf.QueryInterface(Components.interfaces.nsIRDFService);
		if (rdf)
		{
			var localStore = rdf.GetDataSource("rdf:local-store");
			if (localStore)
			{
				// XXX activate last selected list of search engines
				var treeNode = document.getElementById("searchengines");
				var treeChildrenNode = null;
				var numChildren = treeNode.childNodes.length;
				for (var x = 0; x<numChildren; x++)
				{
					if (treeNode.childNodes[x].tagName == "treechildren")
					{
						treeChildrenNode = treeNode.childNodes[x];
						break;
					}
				}
				if (treeChildrenNode != null)
				{
					var numEngines = treeChildrenNode.childNodes.length;
					dump("LoadPage(): " + numEngines + " engines.\n");

					var checkedProperty = rdf.GetResource("http://home.netscape.com/NC-rdf#checked", true);

					for (var x = 0; x<numEngines; x++)
					{
						var treeItem = treeChildrenNode.childNodes[x];
						if (!treeItem)	continue;

						var engineURI = treeItem.getAttribute("id");
						var src = rdf.GetResource(engineURI, true);
						var target = localStore.GetTarget(src, checkedProperty, true);
						if (target)	target = target.QueryInterface(Components.interfaces.nsIRDFLiteral);
						if (target)	target = target.Value;
						if (target == "true")
						{
							dump("loadPage(): Checking '" + engineURI + "\n");
							treeItem.childNodes[0].childNodes[0].childNodes[0].checked = true;
							treeItem.childNodes[0].childNodes[0].childNodes[0].setAttribute("checked", "1");
						}
					}
				}
			}
		}
	}
	catch(ex)
	{
		dump("\nloadPage(): Exception.\n");
	}

	var categoryList = document.getElementById("categoryList");
	if (categoryList)
	{
//		var internetSearch = Components.classes["component://netscape/browser/internetsearch-service"].getService();
		var internetSearch = Components.classes["component://netscape/rdf/datasource?name=internetsearch"].getService();
		if (internetSearch)	internetSearch = internetSearch.QueryInterface(Components.interfaces.nsIInternetSearchService);
		if (internetSearch)
		{
			var catDS = internetSearch.GetCategoryDataSource();
			if (catDS)	catDS = catDS.QueryInterface(Components.interfaces.nsIRDFDataSource);
			if (catDS)
			{
				categoryList.database.AddDataSource(catDS);
				
				// force contents to rebuild
				var ref = categoryList.getAttribute("ref");
				if (ref)	categoryList.setAttribute("ref", ref);
			}
		}
	}

	// check and see if we need to do an automatic search
	if (window.parent)
	{
		var searchText = window.parent.getSearchText();
		if (searchText)
		{
			var textNode = document.getElementById("searchtext");
			if (textNode)
			{
				textNode.setAttribute("value", searchText);
				doSearch();
			}
		}
	}
}



function unloadPage()
{
	try
	{
		var rdf = Components.classes["component://netscape/rdf/rdf-service"].getService();
		if (rdf)   rdf = rdf.QueryInterface(Components.interfaces.nsIRDFService);
		if (rdf)
		{
			var localStore = rdf.GetDataSource("rdf:local-store");
			if (localStore)
			{
				// remember last selected list of search engines
				var treeNode = document.getElementById("searchengines");
				var treeChildrenNode = null;
				var numChildren = treeNode.childNodes.length;
				for (var x = 0; x<numChildren; x++)
				{
					if (treeNode.childNodes[x].tagName == "treechildren")
					{
						treeChildrenNode = treeNode.childNodes[x];
						break;
					}
				}
				if (treeChildrenNode != null)
				{
					var numEngines = treeChildrenNode.childNodes.length;
					dump("unloadPage(): " + numEngines + " engines.\n");

					var checkedProperty = rdf.GetResource("http://home.netscape.com/NC-rdf#checked", true);
					var trueLiteral = rdf.GetLiteral("true");
					var checkedFlag = false;

					for (var x = 0; x<numEngines; x++)
					{
						var treeItem = treeChildrenNode.childNodes[x];
						if (!treeItem)
						{
							dump("unloadPage(): Huh? treeitem is null.\n");
							continue;
						}
						
						checkedFlag = false;

						if (treeItem.childNodes[0].childNodes[0].childNodes[0].checked == true)
						{
							checkedFlag = true;
						}
						else if (treeItem.childNodes[0].childNodes[0].childNodes[0].getAttribute("checked") == "1")
						{
							checkedFlag = true;
						}

						var engineURI = treeItem.getAttribute("id");
						var src = rdf.GetResource(engineURI, true);
						if (checkedFlag == true)
						{
							dump("unloadPage(): Saving '" + engineURI + "'\n");
							localStore.Assert(src, checkedProperty, trueLiteral, true);
						}
						else
						{
							// unassert it just in case its in the localstore, as we don't want to remember it
							localStore.Unassert(src, checkedProperty, trueLiteral, true);
						}
					}

					// XXX for now, need to force a flush
					flushableStore = localStore.QueryInterface(Components.interfaces.nsIRDFRemoteDataSource);
					if (flushableStore)
					{
						flushableStore.Flush();
					}
				}
			}
		}
	}
	catch(ex)
	{
		dump("\nunloadPage(): Exception.\n");
	}
}



function doStop()
{
	var isupports = Components.classes["component://netscape/rdf/datasource?name=internetsearch"].getService();
	if (!isupports)    return(false);
	var internetSearchService = isupports.QueryInterface(Components.interfaces.nsIInternetSearchService);
	if (internetSearchService)
	{
		internetSearchService.Stop();
	}

	// hide progress bar
	var progressNode = parent.frames[1].document.getElementById("search-progress");
	if (progressNode)
	{
		progressNode.setAttribute("style", "display: none;");
	}

	// hide stop button
	var stopButtonNode = document.getElementById("stopbutton");
	if (stopButtonNode)
	{
		stopButtonNode.setAttribute("style", "display: none;");
	}

	// show search button
	var searchButtonNode = document.getElementById("searchbutton");
	if (searchButtonNode)
	{
		searchButtonNode.removeAttribute("style", "display: none;");
	}
}



function checkSearchProgress()
{
	var	activeSearchFlag = false;

	var resultsTree = parent.frames[1].document.getElementById("internetresultstree");
	if (!resultsTree)	return(false);
	var ref = resultsTree.getAttribute("ref");
	var ds = resultsTree.database;

	if ((ref) && (ref != "") && (ds))
	{
		var rdf = Components.classes["component://netscape/rdf/rdf-service"].getService();
		if (rdf)   rdf = rdf.QueryInterface(Components.interfaces.nsIRDFService);
		if (rdf)
		{
			var source = rdf.GetResource(ref, true);
			var loadingProperty = rdf.GetResource("http://home.netscape.com/NC-rdf#loading", true);
			var target = ds.GetTarget(source, loadingProperty, true);
			if (target)	target = target.QueryInterface(Components.interfaces.nsIRDFLiteral);
			if (target)	target = target.Value;
			if (target == "true")
			{
				activeSearchFlag = true;
			}
		}
	}

	if (activeSearchFlag == true)
	{
		setTimeout("checkSearchProgress()", 1000);
	}
	else
	{
		doStop();
	}
	return(true);
}



function doSearch()
{
	// hide search button
	var searchButtonNode = document.getElementById("searchbutton");
	if (searchButtonNode)
	{
		searchButtonNode.setAttribute("style", "display: none;");
	}

	// show stop button
	var stopButtonNode = document.getElementById("stopbutton");
	if (stopButtonNode)
	{
		stopButtonNode.removeAttribute("style", "display: none;");
	}

	// show progress bar
	var progressNode = parent.frames[1].document.getElementById("search-progress");
	if (progressNode)
	{
		progressNode.removeAttribute("style", "display: none;");
	}

	setTimeout("checkSearchProgress()", 1000);

	gText = "";
	gSites = "";

	// get user text to find
	var textNode = document.getElementById("searchtext");
	if (!textNode)	return(false);
	var text = textNode.value;
	if (!text)
	{
		alert("Enter some text to search for and select at least one location to search.");
		return(false);
	}
	dump("Search text: " + text + "\n");

	// get selected search engines
	var treeNode = document.getElementById("searchengines");
	if (!treeNode)	return(false);
	var treeChildrenNode = null;
	var numChildren = treeNode.childNodes.length;
	for (var x = 0; x<numChildren; x++)
	{
		if (treeNode.childNodes[x].tagName == "treechildren")
		{
			treeChildrenNode = treeNode.childNodes[x];
			break;
		}
	}
	if (treeChildrenNode == null)	return(false);

	gText = text;

	var searchURL="";
	var foundEngine = false;

	var numEngines = treeChildrenNode.childNodes.length;
	dump("doSearch(): " + numEngines + " engines.\n");

	for (var x = 0; x<numEngines; x++)
	{
		var treeItem = treeChildrenNode.childNodes[x];
		if (!treeItem)
		{
			dump("doSearch(): huh? treeitem is null.\n");
			continue;
		}

		var checkedFlag = false;

		if (treeItem.childNodes[0].childNodes[0].childNodes[0].checked == true)
		{
			checkedFlag = true;
		}
		else if (treeItem.childNodes[0].childNodes[0].childNodes[0].getAttribute("checked") == "1")
		{
			checkedFlag = true;
		}

		if (checkedFlag == true)
		{
			var engineURI = treeItem.getAttribute("id");
			if (!engineURI)	continue;

			dump ("doSearch(): Checked: # " + x + ":  " + engineURI + "\n");

			var searchEngineName = treeItem.childNodes[0].childNodes[1].childNodes[0].getAttribute("value");
			if (searchEngineName != "")
			{
				if (gSites != "")
				{
					gSites += ", ";
				}
				gSites += searchEngineName;
			}

			if (searchURL == "")
			{
				searchURL = "internetsearch:";
			}
			else
			{
				searchURL += "&";
			}
			searchURL += "engine=" + engineURI;
			foundEngine = true;
		}
	}
	if (foundEngine == false)
	{
		alert("Select at least one location to search.");
		return(false);
	}

	searchURL += "&text=" + escape(text);
	dump("\nInternet Search URL: " + searchURL + "\n");

	// set text in results pane
	var summaryNode = parent.frames[1].document.getElementById("internetresultssummary");
	if (summaryNode)
	{
		var summaryText = "Results of searching for '";
		summaryText += text + "':  ";
		summaryNode.setAttribute("value", summaryText);
	}

	// load find URL into results pane
	var resultsTree = parent.frames[1].document.getElementById("internetresultstree");
	if (!resultsTree)	return(false);
	resultsTree.setAttribute("ref", searchURL);
	// start off showing all engine results
	resultsTree.setAttribute("style", "height: 70%; width: 100%;");
	var contentArea = parent.frames[1].document.getElementById("content");
	if (contentArea)
	{
		contentArea.setAttribute("style", "height: 100; width: 100%;");
		parent.frames[1].frames[0].document.location = "chrome://search/content/default.htm";
	}

	// enable "Save Search" button
	var searchButton = document.getElementById("SaveSearch");
	if (searchButton)
	{
		searchButton.removeAttribute("disabled", "false");
	}

	dump("doSearch done.\n");

	return(true);
}



function doCheck(node)
{
	/* XXX due to a bug, on a mouse-click we also set the
	       checked attribute in the DOM so that it persists */

	if (node.checked == true)
	{
		node.setAttribute("checked", "1");
	}
	else
	{
		node.removeAttribute("checked");
//		node.setAttribute("checked", "0");
	}
	return(false);
}



function doCheckAll(activeFlag)
{
	// get selected search engines
	var treeNode = document.getElementById("searchengines");
	if (!treeNode)	return(false);
	var treeChildrenNode = null;
	var numChildren = treeNode.childNodes.length;
	for (var x = 0; x<numChildren; x++)
	{
		if (treeNode.childNodes[x].tagName == "treechildren")
		{
			treeChildrenNode = treeNode.childNodes[x];
			break;
		}
	}
	if (treeChildrenNode == null)	return(false);

	var numEngines = treeChildrenNode.childNodes.length;
	dump("doCheckAll():  " + numEngines + " engines.\n");

	for (var x = 0; x<numEngines; x++)
	{
		var treeItem = treeChildrenNode.childNodes[x];
		if (!treeItem)
		{
			dump("doCheckAll(): huh? treeItem is null.\n");
			continue;
		}

		var checkedFlag = false;

		if (treeItem.childNodes[0].childNodes[0].childNodes[0].checked == true)
		{
			checkedFlag = true;
		}
		else if (treeItem.childNodes[0].childNodes[0].childNodes[0].getAttribute("checked") == "1")
		{
			checkedFlag = true;
		}

		if (checkedFlag != activeFlag)
		{
			treeItem.childNodes[0].childNodes[0].childNodes[0].checked = activeFlag;
			if (activeFlag)
			{
				treeItem.childNodes[0].childNodes[0].childNodes[0].setAttribute("checked", "1");
			}
			else
			{
				treeItem.childNodes[0].childNodes[0].childNodes[0].removeAttribute("checked");
//				treeItem.childNodes[0].childNodes[0].childNodes[0].setAttribute("checked", "0");
			}
		}
	}

	dump("doCheckAll() done.\n");

	return(true);
}



function saveSearch()
{
	var resultsTree = parent.frames[1].document.getElementById("internetresultstree");
	if (!resultsTree)	return(false);
	var searchURL = resultsTree.getAttribute("ref");
	if ((!searchURL) || (searchURL == ""))		return(false);

	dump("Bookmark search URL: " + searchURL + "\n");

	var bmks = Components.classes["component://netscape/browser/bookmarks-service"].getService();
	if (bmks)	bmks = bmks.QueryInterface(Components.interfaces.nsIBookmarksService);

	var searchTitle = "Search: '" + gText + "' using " + gSites;
	if (bmks)	bmks.AddBookmark(searchURL, searchTitle);

	return(true);
}



function chooseCategory(x)
{
	var val = x.options[x.selectedIndex].getAttribute("id");
	if (val)	val = "NC:SearchCategory?category=" + val;
	else		val = "NC:SearchEngineRoot";

	dump("You have chosen the category: " + val + "\n");

	var treeNode = document.getElementById("searchengines");
	if (!treeNode)	return(false);
	treeNode.setAttribute("ref", val);

	dump("Set that as the ref attribute on the tree.\n");

	return(true);
}
