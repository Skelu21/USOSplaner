chrome.storage.sync.get("active", (data) => {
    if (data.active) {
        let timeRegex = "[0-9]+:[0-9]+";
        let startTimeRegex = timeRegex + "(?= -)";
        let endTimeRegex = "(?<=- )" + timeRegex;
        let hoursRegex = "[0-9]+(?=:)";
        let minutesRegex = "(?<=:)[0-9]+";
        let dayOfWeekRegex ="(poniedziałek|wtorek|środa|czwartek|piątek|sobota|niedziela)";
        let frequencyRegex = "(każd|(?<!nie)parzyste|nieparzyste|niestandardowa)";
        let allSubjects = document.querySelectorAll("td[onclick]");
        let plan = [];
        let allowLecturesCollisions = true;


        class Subject {
            constructor(name, link) {
                this.name = name;
                this.groups = [];
                this.ects = 0;
                this.link = link;
            }

            updateEcts(ects) {
                this.ects = ects;
            }

            updateLink(link) {
                this.link = link;
            }

            addGroup(group) {
                this.groups.push(group);
            }

            highlight() {
                for (let group of this.groups) {
                    for (let reference of group.references) {
                        reference.style.borderColor = "red";
                        reference.style.color = "red";
                    }
                }
            }

            removeHighlight() {
                for (let group of this.groups) {
                    for (let reference of group.references) {
                        reference.style.borderColor = "black";
                        reference.style.color = "black";
                    }
                }
            }
        }


        class Term {
            constructor(starts, ends, day, frequency) {
                this.day = day;
                this.starts = starts;
                this.ends = ends;
                this.frequency = frequency;
            }
        }


        class Group {
            constructor(type, number) {
                this.number = number;
                this.type = type;
                this.terms = [];
                this.references = [];
                this.deactivated = false;
            }

            addTerm(term) {
                this.terms.push(term);
            }

            addHtmlReference(ref) {
                this.references.push(ref);
            }

            highlight() {
                if (!this.deactivated) {
                    for (let reference of this.references) {
                        reference.style.backgroundColor = "#FFDDDD";
                    }
                }
            }

            deactivate() {
                this.deactivated = true;
                for (let reference of this.references) {
                    reference.style.backgroundColor = "#999";
                    reference.style.opacity = "0.4";
                }
            }
            
            activate() {
                this.deactivated = false;
                for (let reference of this.references) {
                    if (this.type === "wykład") {
                        reference.style.backgroundColor = "#FFFFE1";
                    }
                    else {
                        reference.style.backgroundColor = "";
                    }
                    reference.style.opacity = "1.0";
                }
            }

            removeHighlight() {
                if (!this.deactivated) {
                    let colorToSet = "";
                    if (this.type === "wykład") {
                        colorToSet = "#FFFFE1";
                    }
                    for (let reference of this.references) {
                        reference.style.backgroundColor = colorToSet;
                    }
                }
            }
        }


        class Time {
            constructor(hours,minutes) {
                this.hours = hours;
                this.minutes = minutes;
            }
        }


        function nameFromPlanElement(planElement) {
            return planElement.getElementsByTagName('div')[0].textContent.replace(new RegExp("/.*/"), "");
        }

        function getLinkFromPlanElement(planElement) {
            return planElement.getAttribute("onclick").match("https://.*(?=\")")[0];
        }

        function getGroupNumberFromPlanElement(planElement) {
            let link = getLinkFromPlanElement(planElement);
            let group = link.match("(?<=gr_nr=)[0-9]+")[0];
            return parseInt(group);
        }

        function getGroupTermsFromGroupHtml(groupHtml) {
            let termDivs = groupHtml.querySelector("table.grey[style]").querySelectorAll("tr")[2].querySelectorAll("td")[2].querySelectorAll("div");
            let allTerms = [];
            for (let termDiv of termDivs) {
                let divText = termDiv.innerText.toLowerCase();
                let weekdayText = divText.match(dayOfWeekRegex);
                let timeText = divText.match(timeRegex + ".{1,5}" + timeRegex);
                let frequencyText = divText.match(frequencyRegex);
                if (timeText === null || weekdayText === null || frequencyText === null) {
                    continue;
                }
                let startTimeText = timeText[0].match(startTimeRegex)[0];
                let endTimeText = timeText[0].match(endTimeRegex)[0];
                let startTime = timeFromTimeString(startTimeText);
                let endTime = timeFromTimeString(endTimeText);
                let term = new Term(startTime, endTime, weekdayText[0], frequencyText[0]);
                allTerms.push(term);
            }
            return allTerms;
        }

        function timeFromTimeString(timeString) {
            let hours = timeString.match(hoursRegex)[0];
            let minutes = timeString.match(minutesRegex)[0];
            let time = new Time(parseInt(hours), parseInt(minutes));
            return time;
        }

        function getGroupTypeFromGroupHtml(groupHtml) {
            let textResults = groupHtml.querySelector("h1").textContent.toLowerCase().match(/\S.*(?=,)/);
            return textResults[textResults.length - 1];
        }

        function getSubjectLinkFromGroupHtml(groupHtml) {
            return groupHtml.querySelector("h1").querySelector("a[tabindex]").getAttribute("href");
        }

        function getSubjectHtmlFromSubjectLink(subjectLink) {
            let subjectXmlRequest = new XMLHttpRequest;
            subjectXmlRequest.open("get", subjectLink, false);
            subjectXmlRequest.send();
            var subjectDoc;
            let parser = new DOMParser();
            subjectDoc = parser.parseFromString(subjectXmlRequest.responseText, 'text/html');
            return subjectDoc;
        }

        function getSubjectEctsFromSubjectHtml(subjectHtml) {
            return parseFloat(Array.from(subjectHtml.querySelectorAll("tr")).find(el => el.textContent.includes("ECTS")).querySelector(".data").innerText.match("[0-9]+.[0-9]+"));
        }

        function doGroupsCollide(group1, group2, ignoreLectures) {
            if (ignoreLectures) {
                if (group1.type === "wykład" || group2.type === "wykład") {
                    return false;
                }
            }
            for (let term1 of group1.terms) {
                for (let term2 of group2.terms) {
                    if (doTermsCollide(term1, term2)) {
                        return true;
                    }
                }
            }
            return false;
        }

        function doTermsCollide(term1, term2) {
            if (term1.day !== term2.day) {
                return false;
            }
            if (timeComparison(term1.ends, term2.starts) >= 0 || timeComparison(term2.ends, term1.starts) >= 0) {
                return false;
            }
            return true;

        }

        function timeComparison(referenceTime, comparedTime) {
            if (comparedTime.hours > referenceTime.hours) {
                return 1;
            }
            if (comparedTime.hours === referenceTime.hours) {
                if (comparedTime.minutes > referenceTime.minutes) {
                    return 1;
                }
                return 0;
            }
            return -1;
        }

        function getGroupHtmlFromPlanElement(planElement, index) {
            let groupXmlRequest = new XMLHttpRequest();
            groupXmlRequest.open("get", getLinkFromPlanElement(planElement));
            groupXmlRequest.send();
            groupXmlRequest.onloadend = function() {
                let parser = new DOMParser();
                let groupDoc = parser.parseFromString(groupXmlRequest.responseText, 'text/html');
                allGroupHtmls[index] = groupDoc;
                let isReady = true;
                for (let a = 0; a < allGroupHtmls.length; a++) {
                    if (allGroupHtmls[a] === 0) {
                        isReady = false;
                        break
                    }
                }
                if (isReady) {
                    allReady();
                }
            }
        }


        let allGroupHtmls = [];
        for (let planElement of allSubjects) {
            allGroupHtmls.push(0);
        }
        for (let i = 0; i < allSubjects.length; i++) {
            getGroupHtmlFromPlanElement(allSubjects[i], i);
        }


        function allReady() {
        //Tworzenie planu
            let index = 0;
            for (let planElement of allSubjects) {
                let checkedSubjectName = nameFromPlanElement(planElement);
                let isCheckedSubjectNew = true;
                let subjectIndex;
                for (let i = 0; i < plan.length; i++) {
                    if (plan[i].name === checkedSubjectName) {
                        subjectIndex = i;
                        isCheckedSubjectNew = false;
                        break;
                    }
                }
                let groupHtml = allGroupHtmls[index];
                if (isCheckedSubjectNew) {
                    let subjectLink = getSubjectLinkFromGroupHtml(groupHtml);
                    subjectIndex = plan.length;
                    plan.push(new Subject(checkedSubjectName, subjectLink));
                }
                let groupNumber = getGroupNumberFromPlanElement(planElement);
                let groupType = getGroupTypeFromGroupHtml(groupHtml);
                let isGroupNew = true;
                for (let g = 0; g < plan[subjectIndex].groups.length; g++) {
                    if (groupNumber === plan[subjectIndex].groups[g].number && groupType === plan[subjectIndex].groups[g].type) {
                        isGroupNew = false;
                        plan[subjectIndex].groups[g].addHtmlReference(planElement);
                        break;
                    }
                }
                if (isGroupNew) {
                    let groupTerms = getGroupTermsFromGroupHtml(groupHtml);
                    let group = new Group(groupType, groupNumber);
                    group.terms = groupTerms;
                    group.addHtmlReference(planElement);
                    plan[subjectIndex].groups.push(group);
                }
                index += 1;
            }


            function groupSetsCollisionLessCombinations(set1, set2, ignoreLectures) {
                let possibleCombinations = [];
                for (var i = 0; i < set1.length; i++) {
                    for (var j = 0; j < set2.length; j++) {
                        if (!doGroupsCollide(set1[i], set2[j], ignoreLectures)) {
                            possibleCombinations.push([i,j]);
                        }
                    }
                }
                return possibleCombinations;
            }


            for (let subject of plan) {
                for (let group of subject.groups) {
                    for (let reference of group.references) {
                        reference.addEventListener("mouseover", function(window, event) {
                            subject.highlight();
                            group.highlight();
                        });
                        reference.addEventListener("mouseout", function(window, event) {
                            subject.removeHighlight();
                            group.removeHighlight();
                        });
                    }
                }
            }


            let groupsArray = [];
            let reference = [];
            for (let subject of plan) {
                let typesArray = [];
                for (let group of subject.groups) {
                    if (!typesArray.includes(group.type)) {
                        typesArray.push(group.type);
                        reference.push(subject.name + "; " + group.type);
                        groupsArray.push(subject.groups.filter(function(g) {
                            return g.type === group.type;
                        }));
                    }
                }
            }


            let subjectPairsMatrixWithCollisions = [];
            for (let i = 0; i < groupsArray.length; i++) {
                subjectPairsMatrixWithCollisions.push([]);
                for (let j = 0; j < groupsArray.length; j++) {
                    subjectPairsMatrixWithCollisions[i].push([]);
                }
            }
            for (let j = 1; j < groupsArray.length; j++) {
                for (let i = 0; i < j; i++) {
                    subjectPairsMatrixWithCollisions[i][j] = groupSetsCollisionLessCombinations(groupsArray[i], groupsArray[j], true);
                }
            }

            let subjectPairsMatrixWithoutCollisions = [];
            for (let i = 0; i < groupsArray.length; i++) {
                subjectPairsMatrixWithoutCollisions.push([]);
                for (let j = 0; j < groupsArray.length; j++) {
                    subjectPairsMatrixWithoutCollisions[i].push([]);
                }
            }
            for (let j = 1; j < groupsArray.length; j++) {
                for (let i = 0; i < j; i++) {
                    subjectPairsMatrixWithoutCollisions[i][j] = groupSetsCollisionLessCombinations(groupsArray[i], groupsArray[j], false);
                }
            }


            var combinationsArrayWithCollisions = [[]];
            for (let i = 0; i < groupsArray.length; i++) {
                combinationsArrayWithCollisions[0].push(-1);
            }

            for (let j = 0; j < subjectPairsMatrixWithCollisions.length; j++) {
                for (let i = 0; i < j; i++) {
                    let numberOfArraysToCheck = combinationsArrayWithCollisions.length;
                    for (let n = 0; n < numberOfArraysToCheck; n++) {
                        let arrayToCheck = combinationsArrayWithCollisions.shift();
                        for (let k = 0; k < subjectPairsMatrixWithCollisions[i][j].length; k++) {
                            if ((arrayToCheck[j] === -1 || arrayToCheck[j] === subjectPairsMatrixWithCollisions[i][j][k][1]) && (arrayToCheck[i] === -1 || arrayToCheck[i] === subjectPairsMatrixWithCollisions[i][j][k][0])) {
                                let newArray = [...arrayToCheck];
                                newArray[i] = subjectPairsMatrixWithCollisions[i][j][k][0];
                                newArray[j] = subjectPairsMatrixWithCollisions[i][j][k][1];
                                combinationsArrayWithCollisions.push(newArray);
                            }
                        }
                    }
                }
            }


            var combinationsArrayWithoutCollisions = [[]];
            for (let i = 0; i < groupsArray.length; i++) {
                combinationsArrayWithoutCollisions[0].push(-1);
            }

            for (let j = 0; j < subjectPairsMatrixWithoutCollisions.length; j++) {
                for (let i = 0; i < j; i++) {
                    let numberOfArraysToCheck = combinationsArrayWithoutCollisions.length;
                    for (let n = 0; n < numberOfArraysToCheck; n++) {
                        let arrayToCheck = combinationsArrayWithoutCollisions.shift();
                        for (let k = 0; k < subjectPairsMatrixWithoutCollisions[i][j].length; k++) {
                            if ((arrayToCheck[j] === -1 || arrayToCheck[j] === subjectPairsMatrixWithoutCollisions[i][j][k][1]) && (arrayToCheck[i] === -1 || arrayToCheck[i] === subjectPairsMatrixWithoutCollisions[i][j][k][0])) {
                                let newArray = [...arrayToCheck];
                                newArray[i] = subjectPairsMatrixWithoutCollisions[i][j][k][0];
                                newArray[j] = subjectPairsMatrixWithoutCollisions[i][j][k][1];
                                combinationsArrayWithoutCollisions.push(newArray);
                            }
                        }
                    }
                }
            }


            var combinationsArrayCollisionsOnly = combinationsArrayWithCollisions.filter((arr) => !combinationsArrayWithoutCollisions.includes(arr));


            let ectsSum = 0;

            for (let planElement of plan) {
                let subjectHtml = getSubjectHtmlFromSubjectLink(planElement.link);
                ectsSum += getSubjectEctsFromSubjectHtml(subjectHtml); 
            }


            function highlightPlan(allowedSubjects) {
                for (let i = 0; i < groupsArray.length; i++) {
                    for (let j = 0; j < groupsArray[i].length; j++) {
                        if (j === allowedSubjects[i]) {
                            continue;
                        }
                        groupsArray[i][j].deactivate();
                    }
                }
            }


            function removePlanHighlight() {
                for (let groupSet of groupsArray) {
                    for (let group of groupSet) {
                        group.activate();
                    }
                }
            }


            let collisionlessDropdownDiv = document.createElement("div");
            let collisonlessDropdown = document.createElement("select");
            let collisionlessPrevButton = document.createElement("button");
            let collisionlessNextButton = document.createElement("button");
            let collisionlessClearButton = document.createElement("button");
            collisionlessClearButton.innerHTML = "Reset";
            collisionlessPrevButton.innerHTML = "<b><<<</b>";
            collisionlessNextButton.innerHTML = "<b>>>></b>";
            collisionlessNextButton.onclick = function() {
                collisonlessDropdown.selectedIndex = ((parseInt(collisonlessDropdown.selectedIndex) + 1) % combinationsArrayWithoutCollisions.length).toString();
                removePlanHighlight();
                highlightPlan(combinationsArrayWithoutCollisions[parseInt(collisonlessDropdown.value)]);
            };
            collisionlessPrevButton.onclick = function() {
                collisonlessDropdown.selectedIndex = ((parseInt(collisonlessDropdown.selectedIndex) - 1) % combinationsArrayWithoutCollisions.length).toString();
                removePlanHighlight();
                highlightPlan(combinationsArrayWithoutCollisions[parseInt(collisonlessDropdown.value)]);
            };
            collisionlessClearButton.onclick = function() {
                removePlanHighlight();
            }
            let formPlacing = document.querySelector(".greenforms");

            let planIndex = 0;
            for (let allowedSubjectSet of combinationsArrayWithoutCollisions) {
                let dropdownElement = document.createElement("option");
                dropdownElement.value = planIndex.toString();
                dropdownElement.innerHTML = "Plan " + (planIndex + 1).toString();
                dropdown.appendChild(dropdownElement);
                planIndex += 1;
            }

            collisonlessDropdown.onchange = function(dd) {
                removePlanHighlight();
                highlightPlan(combinationsArrayWithoutCollisions[parseInt(this.value)]);
            }
            collisionlessDropdownDiv.appendChild(collisionlessPrevButton);
            collisionlessDropdownDiv.appendChild(collisonlessDropdown);
            collisionlessDropdownDiv.appendChild(collisionlessNextButton);
            collisionlessDropdownDiv.appendChild(collisionlessClearButton);


            let collidingDropdownDiv = document.createElement("div");
            let collidingDropdown = document.createElement("select");
            let collidingPrevButton = document.createElement("button");
            let collidingNextButton = document.createElement("button");
            let collidingClearButton = document.createElement("button");
            collidingClearButton.innerHTML = "Reset";
            collidingPrevButton.innerHTML = "<b><<<</b>";
            collidingNextButton.innerHTML = "<b>>>></b>";
            collidingNextButton.onclick = function() {
                collidingDropdown.selectedIndex = ((parseInt(collidingDropdown.selectedIndex) + 1) % combinationsArrayCollisionsOnly.length).toString();
                removePlanHighlight();
                highlightPlan(combinationsArrayCollisionsOnly[parseInt(collidingDropdown.value)]);
            };
            collidingPrevButton.onclick = function() {
                collidingDropdown.selectedIndex = ((parseInt(collidingDropdown.selectedIndex) - 1) % combinationsArrayCollisionsOnly.length).toString();
                removePlanHighlight();
                highlightPlan(combinationsArrayCollisionsOnly[parseInt(collidingDropdown.value)]);
            };
            collidingClearButton.onclick = function() {
                removePlanHighlight();
            }

            planIndex = 0;
            for (let allowedSubjectSet of combinationsArrayCollisionsOnly) {
                let dropdownElement = document.createElement("option");
                dropdownElement.value = planIndex.toString();
                dropdownElement.innerHTML = "Plan " + (planIndex + 1).toString();
                collidingDropdown.appendChild(dropdownElement);
                planIndex += 1;
            }

            collidingDropdown.onchange = function(dd) {
                removePlanHighlight();
                highlightPlan(combinationsArrayCollisionsOnly[parseInt(this.value)]);
            }
            collidingDropdownDiv.appendChild(collidingPrevButton);
            collidingDropdownDiv.appendChild(collidingDropdown);
            collidingDropdownDiv.appendChild(collidingNextButton);
            collidingDropdownDiv.appendChild(collidingClearButton);

            formPlacing.appendChild(collidingDropdownDiv);


            for(let td of document.querySelectorAll("td")) {
                if (td.style.borderLeft) {
                    td.style.borderLeftColor = "#000000";
                    td.style.borderLeftWidth = "2px";
                }
            }


            let choiceDiv = document.createElement("div");
            choiceDiv.innerHTML = "<b>Bezkolizyjne plany studiów:</b> </br>";
            choiceDiv.style.margin = "10px";
            let lecturesChoiceButton = document.createElement("button");
            var lecturesCollisonsAllowed = false;
            lecturesChoiceButton.backgroundColor = "Crimson";
            lecturesChoiceButton.innerHTML = "Nie zezwalaj na kolizje wykładów";
            collisionlessDropdownDiv.style.display = "block";
            collidingDropdownDiv.style.display = "none";
            lecturesChoiceButton.style.backgroundColor = "Crimson";
            lecturesChoiceButton.style.fontWeight = "bold";
            lecturesChoiceButton.onclick = function() {
                removePlanHighlight();
                if (lecturesCollisonsAllowed) {
                    lecturesCollisonsAllowed = false;
                    this.innerHTML = "Nie zezwalaj na kolizje wykładów";
                    this.style.backgroundColor = "Crimson";
                    collisionlessDropdownDiv.style.display = "block";
                    collidingDropdownDiv.style.display = "none";
                    highlightPlan(combinationsArrayWithoutCollisions[parseInt(collisionlessDropdownDiv.value)]);
                }
                else {
                    lecturesCollisonsAllowed = true;
                    this.innerHTML = "Zezwalaj na kolizje wykładów";
                    this.style.backgroundColor = "ForestGreen";
                    collisionlessDropdownDiv.style.display = "none";
                    collidingDropdownDiv.style.display = "block";
                    highlightPlan(combinationsArrayCollisionsOnly[parseInt(collidingDropdown.value)]);
                }
            };
            lecturesChoiceButton.style.marginTop = "8px";
            lecturesChoiceButton.style.marginBottom = "8px";
            choiceDiv.appendChild(lecturesChoiceButton);


            choiceDiv.appendChild(collisionlessDropdownDiv);
            choiceDiv.appendChild(collidingDropdownDiv);
            formPlacing.appendChild(choiceDiv);


            let ectsDisplay = document.createElement("div");
            ectsDisplay.innerHTML = "Liczba ECTS w planie: <b>" + ectsSum.toString() + "</b>";
            ectsDisplay.margin = "5px";
            formPlacing.appendChild(ectsDisplay);
        }
    }
});