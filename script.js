/*                          Class Definitions
*/

/*                  Survivor Class 
    Sex: (Male/Female) -- No Affect on survivor
    Age: 12-65 -- Affects strength of survivor and also affects how long it will take for their undead form to respawn if turned. Greater the age greater the countdown time.
    Strength: 0-100 -- Affects how effective survivor is at fighting off zombies
    Trustworthiness: 0-5 -- Determines how trustworthy a survivor is. Lower the number the lower the trust. Survivors who are not trustworthy may attack or steal from your party
    Health: 0-100 -- Determines the health of a survivor. 0 means a survivor has died. 100 means a survivor is at maximum health. Health is increased by food and decreased by attacks
    Food: 0-20 -- The amount of food a survivor has. 1 unit of food may restore 10 health to the survivor. 
    Immun: 0-2 -- Determines the immunity of a survivor. 0 means the survivor is not immune to zombie attacks (will lose health and turn if bitten), 1 means the survivor is resistent (will lose health and may turn if bitten), 2 means the survivor is immune (will lose health but not turn if bitten).
    x: (-WIDTH,WIDTH) -- X coordinate of survivor
    y: (-HEIGHT,HEIGHT) -- Y coordinate of survivor
    discovered: True/False -- Determines if this Survivor has been discovered. If Survivor is discovered, it will show up on map for user to navigate toward or away from.
*/

function Survivor(id,firstname,lastname,sex,age,str,trust,health,food,immun,x,y){
    this.id = id;
    this.name = firstname + " " + lastname;
    this.sex = sex;
    this.age = age;
    this.str = str;
    this.trust = trust;
    this.health = health;
    this.maxhealth = health;
    this.immun = immun;
    this.food = food;
    this.maxfood = 20;
    this.x = x;
    this.y = y;
    this.discovered = false;
    this.cooldown = 0;
    this.infected_timer = 25;
    this.infected = false;
    this.levelup = 5;
    this.level = 1;
    this.kills = 0;
    this.dead = false;
    
    this.gainEXP = function(){
        this.kills = this.kills + 1;
        console.log("Kills :" + this.kills);
        if(this.kills >= this.levelup){
            this.level++;
            this.levelup = this.levelup*2;
            this.str = Math.round(this.str*1.1);
            this.maxhealth = Math.round(this.maxhealth*1.1);
            this.maxfood = Math.round(this.maxfood*1.05);
        };
    };
    
    if(immun <= 1){
        this.imlev = "Low";
    } else if (immun <= 5){
        this.imlev = "Moderate";
    } else {
        this.imlev = "High";
    };
    
    this.Discover = function(){
        this.discovered = true;
    };
    
    this.zombify = function(){
        var ind = SURVIVOR_GROUP.indexOf(this)
        if (ind >=0){
            SURVIVOR_GROUP.splice(ind,1);
            ZOMBIE_GROUP.push(new Zombie(200,this.str,this.x,this.y));
        } else {
            //console.log("Element not in array.")
        };
        
        var ind2 = PLAYER_TEAM.members.indexOf(this)
        if (ind2 >=0){
            PLAYER_TEAM.members.splice(ind2,1);
            ZOMBIE_GROUP.push(new Zombie(200,this.str,PLAYER_TEAM.x,PLAYER_TEAM.y));
        } else {
            //console.log("Element not in array.")
        };
    };
    
    this.reduceCoolDown = function(){
        if(this.cooldown > 0){
            this.cooldown --;
        };
        if (this.infected && this.infected_timer > 0){
            this.infected_timer --;
        } else if (this.infected && this.infected_timer==0){
            this.zombify();
        }
    };
    this.setCoolDown = function(){
        this.cooldown = 25;
    }
    
    this.rollTheDice = function(){
        if(Math.random() > Math.random()*this.immun && this.infected == false){
            this.infected=true;
        };
    };
    
    this.fightZombie = function(zombie){
        zombie.health =
        Math.max(0,zombie.health -
                 (this.str - Math.round((zombie.str/5))));
        this.health =
        Math.max(0,this.health -
                 (zombie.str - Math.round((this.str/3))));
        if (this.health > 0){
            //console.log("Huh");
            this.rollTheDice();
            //console.log("What?");
        } else {
            this.infected = true;
            this.dead = true;
        };
        if (zombie.health == 0){
            this.gainEXP();
            var ind = ZOMBIE_GROUP.indexOf(zombie);
            if (ind >=0){
                ZOMBIE_GROUP.splice(ind,1);
            } else {
                console.log("Element not in array.")
            };
        };
    };
    
    this.gatherFood = function(food){
        var maxdemand = this.maxfood;
        var supply = this.food;
        
        if(supply != maxdemand){
            var demand = maxdemand - supply;
            var food_taken = food.takeFood(demand);
            this.food =
                this.food + Math.min(this.maxfood-this.food,food_taken);
        };
    };
    
    this.consumeFood = function(){
        if(this.health < Math.round(.75*this.maxhealth) && this.food > 0){
            this.food--;
            this.health = this.health + 10;
        }
    }
};

/*                  Zombie
    Health: 0 - 200 -- Determines the health of a zombie.
    Str: 0-100 -- Strength of zombie (was strength of human version)
    x: (-WIDTH,WIDTH) -- X coordinate of zombie
    y: (-HEIGHT,HEIGHT) -- Y coordinate of zombie
    discovered: True/False -- Determines if this Zombie has been discovered. If Zombie is discovered, it will show up on map for user to navigate toward or away from.
*/
function Zombie(health, str,x,y){
    this.health = health;
    this.str = str;
    this.x = x;
    this.y = y;
    this.discovered = false;
    
    this.Discover = function(){
        this.discovered = true;
    };
    
    this.chaseHuman = function(){
        var humans = PLAYER_TEAM.members.concat(SURVIVOR_GROUP);
        var xdist,ydist,dist = 0;
        var min_dist = 100000;
        var closest_human = humans[1];
    
        for(j=0; j < humans.length;j++){
            if (humans[j].dead == false){
                xdist = Math.pow(humans[j].x - this.x,2);
                ydist = Math.pow(humans[j].y - this.y,2);
                dist = Math.sqrt(xdist + ydist);
                if (min_dist > dist){
                    min_dist = dist;
                    closest_human = humans[j];
                };
            };
        };
        return [closest_human,min_dist];
    };
};

/*                  Food
    food_pts: 0 - 5000 -- One food point restores 10 health for each survivor in the group. Each survivor can at most take 20 food points.
    x: (-WIDTH, WIDTH) -- X coordinate of food
    y: (-HEIGHT, HEIGHT) -- Y coordinate of food
    discovered: True/False -- Determines if this food has been discovered. If food is discovered, it will show up on map for user to navigate towards. 
*/
function Food(food_pts,x,y){
    this.food_pts = food_pts;
    this.x = x;
    this.y = y;
    this.discovered = false;
    
    this.Discover = function(){
        this.discovered = true;
    };
    this.takeFood = function(demand){
        console.log("Available Pts: " + this.food_pts)
        var food_taken = Math.min(food_pts,demand);
        this.food_pts = this.food_pts - food_taken;
        console.log("Inside Take Food - Food Taken: " + food_taken);
        console.log("Inside Take Food - Food Pts: " + this.food_pts);
        if(this.food_pts == 0){
            var ind = FOOD_GROUP.indexOf(this)
            if (ind >=0){
                FOOD_GROUP.splice(ind,1);
            } else {
                console.log("Food not in array.")
            };
        };
        return food_taken;
    };
};

/*                      Team                                    team_count: Number of survivors in your team. This number is initialized to one (starting with main character).
    team_health: Combined health of the team
    team_resources: Combined food that the team owns
    team_trust: Average trust of all survivors on team
    team_strength: Average strength of all survivors on team
*/
function Team(){
    this.count = 3;
    this.members = [];
    this.x = 0;
    this.y = 0;
    this.sight = 4;
    this.food = 50;
    
    this.addMember = function(survivor){
        this.members.push(survivor);
        //this.sight = Math.round(this.members.length/5) + 4;
        var ind = SURVIVOR_GROUP.indexOf(survivor);
        if (ind >=0){
            SURVIVOR_GROUP.splice(ind,1);
        } else {
            //console.log("Element not in array.")
        };
    };
    this.removeMember = function(survivor){
        var ind = this.members.indexOf(survivor)
        if (ind >=0){
            this.members.splice(ind,1);
        } else {
            //console.log("Element not in array.")
        };
        survivor.setCoolDown();
        survivor.x = this.x;
        survivor.y = this.y;
        SURVIVOR_GROUP.push(survivor);
    };
    
    this.isGameOver =  function(){
        if(PLAYER_TEAM.members.length == 0){
            alert("Everyone in your group has died...");
            SURVIVOR_GROUP = [];
            ZOMBIE_GROUP = [];
        };
    };
    
     /*this.zombify = function(survivor){
        var ind = PLAYER_TEAM.members.indexOf(survivor)
        if (ind >=0){
            alert(survivor.name + " has turned into a zombie!");
            resetKeys();
            PLAYER_TEAM.members.splice(ind,1);
            ZOMBIE_GROUP.push(new Zombie(200,this.str,this.x,this.y));
        } else {
            //console.log("Element not in array.")
        };
        this.isGameOver();
    };*/
    
    this.fightSurvivor = function(survivor){
        for(l = 0; l < this.members.length;l++){
            if(survivor.health > 0){
                survivor.health =
                Math.max(0,survivor.health -
                         (this.members[l].str - Math.round((survivor.str/3))));
                this.members[l].health =
                Math.max(0,this.members[l].health -
                         (survivor.str - Math.round((this.members[l].str/3))));
                if (this.members[l].health == 0){
                    //this.zombify(this.members[l]);
                    this.members[l].infected = true;
                    this.members[l].dead = true;
                    SURVIVOR_GROUP.push(this.members[l]);
                    if (l >=0){
                        this.members.splice(l,1);
                    } else {
                        //console.log("Element not in array.")
                    };
                    alert(this.members[l].name + " has died!");
                    resetKeys();
                }
                if (survivor.health == 0){
                    //survivor.zombify();
                    alert(survivor.name + " has died!");
                    survivor.infected = true;
                    survivor.dead = true;
                    resetKeys();
                    this.members[l].gainEXP();
                    break;
                }
                //console.log("Health: " + survivor.health);
            };
        };
    };
    
    this.rollTheDice = function(survivor){
        if(Math.random() > Math.random()*survivor.immun && survivor.infected == false){
            survivor.infected=true;
            alert(survivor.name + " has been infected!");
            resetKeys();
        };
    };
    
    this.fightZombie = function(zombie){
        for(k=0; k < this.members.length; k++){
            if(zombie.health > 0){
                zombie.health =
                Math.max(0,zombie.health -
                         (this.members[k].str - Math.round((zombie.str/5))));
                this.members[k].health =
                Math.max(0,this.members[k].health -
                         (zombie.str - Math.round((this.members[k].str/3))));
                if (this.members[k].health > 0){
                    //console.log("Huh");
                    this.rollTheDice(this.members[k]);
                    //console.log("What?");
                } else {
                    alert(this.members[k].name + " has died!");
                    resetKeys();
                    this.members[k].infected = true;
                    this.members[k].dead = true;
                    SURVIVOR_GROUP.push(this.members[k]);
                    if (k >=0){
                        this.members.splice(k,1);
                    } else {
                        //console.log("Element not in array.")
                    };
                    //this.zombify(this.members[k]);
                };
                if (zombie.health == 0){
                    this.members[k].gainEXP();
                    alert("Killed the zombie!");
                    resetKeys();
                    var ind = ZOMBIE_GROUP.indexOf(zombie);
                    if (ind >=0){
                        ZOMBIE_GROUP.splice(ind,1);
                    } else {
                        console.log("Element not in array.")
                    };
                    break;
                };
            };
        };
    };
    
    this.gatherFood = function(food){
        var maxdemand = this.members.length*20
        var supply = 0;
        for (j = 0; j < this.members.length; j++){
            supply = supply + this.members[j].food;
        };
        
        
        if(supply != maxdemand){
            var demand = maxdemand - supply;
            var food_taken = food.takeFood(demand);
            for (j = 0; j < this.members.length; j++){
                this.members[j].food =
                this.members[j].food + Math.min(this.members[j].maxfood-this.members[j].food,food_taken);
                food_taken = food_taken - Math.min(this.members[j].maxfood-this.members[j].food,food_taken);
            };
        };
    };
    
    this.consumeFood = function(food){
        for(j = 0; j < this.members.length; j++){
            if(this.members[j].food > 0 && this.members[j].health <= this.members[j].maxhealth-10){
                this.members[j].food --;
                this.members[j].health = Math.min(this.members[j].health + 10,
                                                  this.members[j].maxhealth);
            };
        };
    }
    
};

/*---------------------------------------------------------*/

/*                  Game Constants & Variables
*/

var WIDTH = 250
var HEIGHT = 250
var INITIAL_ZOMBIE_COUNT = 900
var INITIAL_SURVIVOR_COUNT = 600
var FOOD_COUNT = 450
var CLOCK_SPEED = .25; //Percent of a second

var SURVIVOR_GROUP = []
var ZOMBIE_GROUP = []
var FOOD_GROUP = []
var keys = [];

var PLAYER_TEAM = new Team();

var xcent = 0;
var ycent= 0;

var steps_per_day = 24;
var total_hours = 0;

var LAST_NAMES = ["Donovan","Suarez","Vibbit","Johnson","Kendrick","Watterson","Kim","Lee","Ekuelle","Barry","Souvignet","Valls","Dominguez","Nelson","Barnett","Eddington","Wilson","Edison","Gupta","Henderson","Chandrasekar","Gandhi","Peterson","Jameson","Montand","Jean-Francois","Grey","Vasta","Ignacolla","Bunyea","Hallenbeck","Daniels","Hicks","Salline","Garret","Shabalala","Henry","Sakho","Acquah","Ronaldo","Palma","Lima","Nielsen","Cole","Courdry","Stewart","Sadgic","Kelso","Temeng","Barto","Koch","Sinese"]

var FIRST_NAMES_MALE = ["Derrick","John","Bobby","Richard","Thomas","Tyrone","Willis","William","Jack","Garret","Bill","Cedric","Matt","Matthew","Eric","Kwame","Yves","Jerry","Akash","Murali","Siqiang","Ye","Nigel","Rory","Christian","Chris","Nick","Nicholas","Maurice","Rick","Peter","Pete","Quade","Dwayne","Milhouse","Victor","Charlie","Xavier","Juan","Jose","Sebastian","Jesus","Ollie","Fernando","Zachary","Geoffery","Ned","Nathan","Frederick","Wilson"]

var FIRST_NAMES_FEMALE = ["Donna","Carey","Malvika","Swati","Sweta","Keisha","LaTondra","Jane","Janet","Helga","Barbara","Karen","Rita","Julia","Lily","Lillian","Junwen","Zihe","Juanita","Evelyn","Janine","Genevieve","Candy","Patricia","Elaine","Mona","Tess","Molina","Vicky","Vickie","Christa","Chris","Lisa","Lisette","Gia","Marta","Christin","Layla","Zasha","Brittney","Norah","Nayla","Deanna","Diana","Aba","Abby","Abigail"]

/*---------------------------------------------------------*/
/*                      Game Clock                  
The clock object keeps time game events with user decisions by
pausing and resuming the game
*/
function Clock(){
    var state = setInterval(function(){},CLOCK_SPEED*1000);
    
    this.start = function(fxn){
        var func = fxn;
        state = setInterval(function(){func()},CLOCK_SPEED*1000);
    };
    
    this.pause = function(){
        clearInterval(state);
    };
};

//Create the game Clock
var timer = new Clock();
var rounds = 0;
var minutes = 0;

var gameStarted = false;
var gameRunning = false;

/* ------------------------------------------------------*/
function resetKeys(){
    keys[37] = false;
    keys[38] = false;
    keys[39] = false;
    keys[40] = false;
    
    keys[83] = false;
    keys[70] = false;
    keys[69] = false;
    keys[76] = false;
    
    keys[73] = false;
    keys[72] = false;
}

function init_players(){
    
    SURVIVOR_GROUP = [];
    ZOMBIE_GROUP = [];
    FOOD_GROUP = [];
    
    var sex = "";
    var age = 0;
    var str = 0;
    var health = 0;
    var fname = "";
    var lname = "";
    var trust = 0;
    var immun = 0;
    var food = 0;
    var x = 0;
    var y = 0;

    var len = Math.max(INITIAL_SURVIVOR_COUNT,INITIAL_ZOMBIE_COUNT,FOOD_COUNT);
    for (i = 1; i <= len; i++){
       if (Math.random() > .5){
            sex = "Male";
        } else {
            sex = "Female";
        };
        
        if (sex == "Male") {
            fname = FIRST_NAMES_MALE[Math.round(Math.random()*FIRST_NAMES_MALE.length)-1];
            lname = LAST_NAMES[Math.round(Math.random()*LAST_NAMES.length)-1];
        } else {
            fname = FIRST_NAMES_FEMALE[Math.round(Math.random()*FIRST_NAMES_FEMALE.length)-1];
            lname = LAST_NAMES[Math.round(Math.random()*LAST_NAMES.length)-1];
        }
       age = Math.round(Math.random()*(53)) + 12;
       
       food = Math.round(Math.random()*20);
        
        str = Math.max(Math.min(Math.round(Math.random()*100*(1-(age/65))+ Math.random()*age),100),25);
        
        health = Math.round(100 - Math.pow(Math.random(),2)*age);
        
        trust = Math.round(Math.random()*5);
        
        if ( Math.random() > .9 ){
            immun = 10;
        } else if ( Math.random() > .7 ){
            immun = 5;
        } else if ( Math.random() > .4 ){
            immun = 3;
        } else {
            immun = 1;
        }
        
        x = Math.round(Math.random()*WIDTH - Math.random()*WIDTH);
        y = Math.round(Math.random()*HEIGHT - Math.random()*HEIGHT);
        
       SURVIVOR_GROUP.push(
            new Survivor(i,fname,lname,sex,age,str,trust,health,food,immun,x,y) 
        );
       //console.log(SURVIVOR_GROUP[i]);
        
        if(i <= INITIAL_ZOMBIE_COUNT){
            ZOMBIE_GROUP.push(
                new Zombie(200,40,
                Math.round(Math.random()*WIDTH - Math.random()*WIDTH),
                Math.round(Math.random()*HEIGHT - Math.random()*HEIGHT))
                );
        };
        
        if (i <= FOOD_COUNT) {
            var rand = Math.random()
            var food_pts = 0;
            if (rand > .98){
                food_pts = 5000;
            } else if (rand > .9){
                food_pts = 500;
            } else if (rand > .7){
                food_pts = 200;
            } else if (rand > .5){
                food_pts = 50;
            } else {
                food_pts = 5;
            };
            FOOD_GROUP.push(
                    new Food(food_pts,
                    Math.round(Math.random()*WIDTH - Math.random()*WIDTH),
                    Math.round(Math.random()*HEIGHT - Math.random()*HEIGHT))
                    );
        };
    }; 
};

function moveEntities(){
    var len = Math.max(SURVIVOR_GROUP.length,ZOMBIE_GROUP.length);
    for (i=0; i < len; i++){
        if( i < SURVIVOR_GROUP.length){
            SURVIVOR_GROUP[i].reduceCoolDown();
        }
        
        if (i < SURVIVOR_GROUP.length && SURVIVOR_GROUP[i].dead == false){
            var rand = Math.random();
            if (rand > .75){
                SURVIVOR_GROUP[i].x = SURVIVOR_GROUP[i].x + 1;
            } else if (rand > .5){
                SURVIVOR_GROUP[i].x = SURVIVOR_GROUP[i].x - 1;
            } else if (rand > .25){
                SURVIVOR_GROUP[i].y = SURVIVOR_GROUP[i].y - 1;
            } else {
                SURVIVOR_GROUP[i].y = SURVIVOR_GROUP[i].y + 1;
            };
        };
        
        if (i < ZOMBIE_GROUP.length){
            rand = Math.random();
            if (rand > .75){
                    ZOMBIE_GROUP[i].x = ZOMBIE_GROUP[i].x + 1;
                } else if (rand > .5){
                    ZOMBIE_GROUP[i].x = ZOMBIE_GROUP[i].x - 1;
                } else if (rand > .25){
                    ZOMBIE_GROUP[i].y = ZOMBIE_GROUP[i].y - 1;
                } else {
                    ZOMBIE_GROUP[i].y = ZOMBIE_GROUP[i].y + 1;
                };
            /*var arr = ZOMBIE_GROUP[i].chaseHuman();
            if (arr[1] < PLAYER_TEAM.sight){
                if(rand > .5){
                    if (arr[0].x > ZOMBIE_GROUP[i].x) {
                        ZOMBIE_GROUP[i].x = ZOMBIE_GROUP[i].x + 1;
                    } else if (arr[0].x < ZOMBIE_GROUP[i].x) {
                        ZOMBIE_GROUP[i].x = ZOMBIE_GROUP[i].x - 1;
                    } else {
                        if (arr[0].y > ZOMBIE_GROUP[i].y) {
                            ZOMBIE_GROUP[i].y = ZOMBIE_GROUP[i].y + 1;
                        } else if (arr[0].y < ZOMBIE_GROUP[i].y) {
                            ZOMBIE_GROUP[i].y = ZOMBIE_GROUP[i].y - 1;
                        };
                    };
                } else {
                     if (arr[0].y > ZOMBIE_GROUP[i].y) {
                        ZOMBIE_GROUP[i].y = ZOMBIE_GROUP[i].y + 1;
                    } else if (arr[0].y < ZOMBIE_GROUP[i].y) {
                        ZOMBIE_GROUP[i].y = ZOMBIE_GROUP[i].y - 1;
                    } else {
                        if (arr[0].x > ZOMBIE_GROUP[i].x) {
                            ZOMBIE_GROUP[i].x = ZOMBIE_GROUP[i].x + 1;
                        } else if (arr[0].x< ZOMBIE_GROUP[i].x) {
                            ZOMBIE_GROUP[i].x = ZOMBIE_GROUP[i].x - 1;
                        };
                    };
                };
            } else {
                if (rand > .75){
                    ZOMBIE_GROUP[i].x = ZOMBIE_GROUP[i].x + 1;
                } else if (rand > .5){
                    ZOMBIE_GROUP[i].x = ZOMBIE_GROUP[i].x - 1;
                } else if (rand > .25){
                    ZOMBIE_GROUP[i].y = ZOMBIE_GROUP[i].y - 1;
                } else {
                    ZOMBIE_GROUP[i].y = ZOMBIE_GROUP[i].y + 1;
                };
            };*/
        };
        
        len = Math.max(SURVIVOR_GROUP.length,ZOMBIE_GROUP.length);
    };
};

function survivorCollide(){
    var len = Math.max(ZOMBIE_GROUP.length,FOOD_GROUP.length);
    var x,y = 0;
    for (j=0; j < SURVIVOR_GROUP.length; j++){
        x = SURVIVOR_GROUP[j].x;
        y = SURVIVOR_GROUP[j].y;
        
        for(i=0; i < len; i++){
            if( i < ZOMBIE_GROUP.length){
                if ((ZOMBIE_GROUP[i].x >= x - 1 && ZOMBIE_GROUP[i].x <= x + 1)
                && (ZOMBIE_GROUP[i].y >= y - 1 && ZOMBIE_GROUP[i].y <= y + 1)){
                    //Survivor fights zombie
                    SURVIVOR_GROUP[j].fightZombie(ZOMBIE_GROUP[i])
                    console.log("A survivor is fighting a zombie");
                };
            };
            
            if( i < FOOD_GROUP.length){
                if ((FOOD_GROUP[i].x >= x - 1 && FOOD_GROUP[i].x <= x + 1)
                && (FOOD_GROUP[i].y >= y - 1 && FOOD_GROUP[i].y <= y + 1)){
                    //Survivor gathers food
                    SURVIVOR_GROUP[j].gatherFood(FOOD_GROUP[i]);
                    console.log("A survivor is gathering food");
                };
            };
        }
    }
}

function teamCollide(x,y){
    var len = Math.max(SURVIVOR_GROUP.length,ZOMBIE_GROUP.length,FOOD_GROUP.length);
    for (i =0; i < len;i++){
        if(i < PLAYER_TEAM.members.length){
            PLAYER_TEAM.members[i].reduceCoolDown();
            if (PLAYER_TEAM.members[i].infected){
                console.log("Infected Timer: " + PLAYER_TEAM.members[i].infected_timer);
            }
        };
        
        if( i < SURVIVOR_GROUP.length){
            if ((SURVIVOR_GROUP[i].x >= x - 1 && SURVIVOR_GROUP[i].x <= x + 1)
            && (SURVIVOR_GROUP[i].y >= y - 1 && SURVIVOR_GROUP[i].y <= y + 1)){
                if(SURVIVOR_GROUP[i].trust >= 2 && SURVIVOR_GROUP[i].cooldown == 0
                   && SURVIVOR_GROUP[i].dead == false){
                    var add = window.confirm("A survivor asks to join you...\n" + 
                                             SURVIVOR_GROUP[i].name +
                                             ":\n Sex: " + SURVIVOR_GROUP[i].sex +
                                             "\n Age: " + SURVIVOR_GROUP[i].age +
                                             "\n Strength: " + SURVIVOR_GROUP[i].str +
                                             "\n Trust: " + SURVIVOR_GROUP[i].trust +
                                             "\n Immunity: " + SURVIVOR_GROUP[i].imlev +
                                             "\n Food: " + SURVIVOR_GROUP[i].food +
                                             "\n Health: " + SURVIVOR_GROUP[i].health);
                    if (add){
                        alert(SURVIVOR_GROUP[i].name + " joined your group!");
                        resetKeys();
                        PLAYER_TEAM.addMember(SURVIVOR_GROUP[i]);
                        //console.log("Add member");
                    } else {
                        alert(SURVIVOR_GROUP[i].name + " continued on their own.");
                        resetKeys();
                        SURVIVOR_GROUP[i].setCoolDown();
                        console.log("Don't add member");
                    }
                } else if (SURVIVOR_GROUP[i].trust < 2) {
                    PLAYER_TEAM.fightSurvivor(SURVIVOR_GROUP[i]);
                    console.log("FIGHT!");
                };
            };
        };
        if( i < ZOMBIE_GROUP.length){
            if ((ZOMBIE_GROUP[i].x >= x - 1 && ZOMBIE_GROUP[i].x <= x + 1)
            && (ZOMBIE_GROUP[i].y >= y - 1 && ZOMBIE_GROUP[i].y <= y + 1)){
                console.log("Zombie encounter");
                PLAYER_TEAM.fightZombie(ZOMBIE_GROUP[i]);
            };
            
        };
        if( i < FOOD_GROUP.length){
            if ((FOOD_GROUP[i].x >= x - 1 && FOOD_GROUP[i].x <= x + 1)
            && (FOOD_GROUP[i].y >= y - 1 && FOOD_GROUP[i].y <= y + 1)){
                //console.log("Food found");
                //console.log("FOOD condition: " + i);
                PLAYER_TEAM.gatherFood(FOOD_GROUP[i]);
            };
            
        };
    };
};



function getStatus(){
    document.getElementById("Team Count").innerHTML = "Survivors in Group: " + SURVIVOR_GROUP.length;
    document.getElementById("Nearby Zombies").innerHTML = "Nearby Zombies: " + ZOMBIE_GROUP.length;
};

function displayTeam(){
    var team_string = "";
    for (i=0;i < PLAYER_TEAM.members.length; i++){
        team_string = team_string + PLAYER_TEAM.members[i].name +
        " (LVL:" + PLAYER_TEAM.members[i].level +
        ") :<br> Sex: " + PLAYER_TEAM.members[i].sex +
        "<br> Age: " + PLAYER_TEAM.members[i].age +
        "<br> Strength: " + PLAYER_TEAM.members[i].str +
        "<br> Trust: " + PLAYER_TEAM.members[i].trust +
        "<br> Immunity: " + PLAYER_TEAM.members[i].imlev +
        "<br> Food: " + PLAYER_TEAM.members[i].food +
        "/" + PLAYER_TEAM.members[i].maxfood + 
        "<br> Health: " + PLAYER_TEAM.members[i].health +
        "/" + PLAYER_TEAM.members[i].maxhealth +
        "<br> Kills: " + PLAYER_TEAM.members[i].kills + "<br><br>";
    };
    document.getElementById("TeamInfo").innerHTML = team_string;
};

function displayInstructions(){
    var instructions = "<h3 id=\"InstructionsTitle\"></h3>";
    instructions = instructions +
    "<p><b>0) The red circle indicates your group of survivors. Blue circles indicate" +
    " independent survivors. If they are not trustworthy, they will attack you." +
    " Otherwise, they will ask to join your group. The" +
    " grey circles indicate zombies which can infect both independent survivors as well" +
    " as your group. The yellow circles indicate sources of food for your group" +
    " and other survivors to gather to stay healthy.</b><br><br>" +
    "1) Use the arrow keys to navigate the map. <br><br>" +
    "2) Press the 'S' key to sort your team by the strongest members.<br>" +
    "(They encounter zombies first in fights) <br><br>" +
    "3) Press the 'F' key to sort your team by the members with the least food.<br>" + 
    " (They earn priority when collecting food) <br><br>" +
    "4) Press the 'L' key to kick out members who are infected.<br><br>" +
    "5) Press the 'I' key to sort your team by immunity level. <br>" +
    " (They are less likely to be infected during zombie encounters) <br><br>" +
    "6) Press the 'E' key to have your team consume one unit of food.<br>" +
    " (1 unit of food restores 10 health. <br> If a member has full health they will not eat) <br><br>" +
    "7) Press the 'H' key to sort your team by highest health.<br><br>" +
    "8) The more zombies and untrustworthy survivors you kill, the more" +
    " experience you will gain. Gaining experiences increases your stats.<br><br>" +
    "9) Once everyone in your group dies, the game is over. Even if you die, someone" +
    " else may continue leading your group if there are others still alive.</p>"
    document.getElementById("Instructions").innerHTML = instructions;
};

function drawMap(){
    var c = document.getElementById("Map");
    var ctx = c.getContext("2d");
    
    ctx.fillStyle = 'green';
    ctx.fillRect(0,0,500,500);
    
    //Draw gridlines
    for(i = 1; i < PLAYER_TEAM.sight*2 + 1;i++){
        ctx.moveTo(500*(i/(PLAYER_TEAM.sight*2 + 1)),0);
        ctx.lineTo(500*(i/(PLAYER_TEAM.sight*2 + 1)),500);
        ctx.stroke();
        ctx.moveTo(0,500*(i/(PLAYER_TEAM.sight*2 + 1)));
        ctx.lineTo(500,500*(i/(PLAYER_TEAM.sight*2 + 1)));
        ctx.stroke();
    }
};

function drawMiniMap(){
    var c = document.getElementById("Map");
    var ctx = c.getContext("2d");
    
    ctx.fillStyle = '#35357C';
    ctx.fillRect(0,500 ,
                 500,200);
    
    var dim = Math.round(500/3);
    
    ctx.fillStyle = 'black';
    ctx.fillRect(dim,500 + (200-dim)/2,
                 dim,dim);
    
    var minix = Math.round((PLAYER_TEAM.x*dim/2)/WIDTH);
    var miniy = Math.round((PLAYER_TEAM.y*dim/2)/HEIGHT);
    
    ctx.fillStyle = 'red';
    ctx.fillRect(minix + Math.round((3/2)*dim),
                 miniy + Math.round(500 + (200-dim)/2 + dim/2),
                 1,1);
    
    ctx.font = "26px Helvetica";
    ctx.fillText("Days Alive:",15,500 + (200-dim));
    
    ctx.font = "26px Helvetica";
    ctx.fillText(Math.round(total_hours/24),15,500 + (200-dim)*2);
    
    ctx.font = "26px Helvetica";
    ctx.fillText("Survivors in",2*(500/3) + 15,500 + (200-dim));
    
    ctx.font = "26px Helvetica";
    ctx.fillText("Party:",2*(500/3) + 15,500 + (200-dim)*2);
    
    ctx.font = "26px Helvetica";
    ctx.fillText(PLAYER_TEAM.members.length,2*(500/3) + 15,500 + (200-dim)*3);
};

function refreshMap(sight){
    var c = document.getElementById("Map");
    var ctx = c.getContext("2d");
    
    for (i = -sight; i <= sight ;i++){
        for(j = -sight; j <= sight ;j++){
            ctx.beginPath();
        
            ctx.arc(500/2 + (i)*(500/(sight*2+1)),
                    500/2 + (j)*(500/(sight*2+1)),
                    500/((sight*2+1)*2.5),0,2*Math.PI);
            ctx.fillStyle = 'green';
            ctx.fill();
            ctx.strokeStyle = 'green';
            ctx.stroke();
        }
    }
};

/*      Draw Team on Map
  xdelt: Change in x direction (-1,1)
  ydelt: Change in y direction (-1,1)
  sight: Current PLAYER_TEAM sight
*/
function drawTeam(xdelt,ydelt,sight){
    var x = PLAYER_TEAM.x + xdelt;
    var y = PLAYER_TEAM.y + ydelt;
    var boundary_crossed = "None";
    
    var c = document.getElementById("Map");
    var ctx = c.getContext("2d");
    
    /*
    //Erase previous avatar image
    if ( !((xdelt == 0) && (ydelt == 0)) ){
        ctx.beginPath();
        
        ctx.arc(500/2 + (PLAYER_TEAM.x-xcent)*(500/(sight*2+1)),
                500/2 + (PLAYER_TEAM.y-ycent)*(500/(sight*2+1)),
                500/((sight*2+1)*3),0,2*Math.PI);
        ctx.fillStyle = 'green';
        ctx.fill();
        ctx.strokeStyle = 'green';
        ctx.stroke();
    };
    */
    
    //Crossing map border?
    if (xcent + sight < x){
        boundary_crossed = "East";
        //console.log(boundary_crossed);
        xcent = xcent + (sight*2 + 1);
        ycent = ycent;
        //console.log("New center -- xcent: " + xcent + ", ycent: " + ycent);
    } else if (xcent - sight > x){
        boundary_crossed = "West";
        //console.log(boundary_crossed);
        xcent = xcent - (sight*2 + 1);
        ycent = ycent;
        //console.log("New center -- xcent: " + xcent + ", ycent: " + ycent);
    } else if (ycent + sight < y){
        //console.log(y + ydelt);
        boundary_crossed = "South";
        //console.log(boundary_crossed);
        xcent = xcent;
        ycent = ycent + (sight*2 + 1);
        //console.log("New center -- xcent: " + xcent + ", ycent: " + ycent);
    } else if (ycent - sight > y){
        boundary_crossed = "North";
        //console.log(boundary_crossed);
        xcent = xcent;
        ycent = ycent - (sight*2 + 1);
        //console.log("New center -- xcent: " + xcent + ", ycent: " + ycent);
    }
    
    ctx.beginPath();
    //console.log("x:" + x + ", y:" + y);
    ctx.arc(500/2 + (x-xcent)*(500/(sight*2+1)), //+ xdelt*(500/(sight*2+1)),
            500/2 + (y-ycent)*(500/(sight*2+1)), //+ ydelt*(500/(sight*2+1)),
            500/((sight*2+1)*2.5),0,2*Math.PI);
    ctx.fillStyle = 'red';
    ctx.fill();
    ctx.strokeType = 'black';
    ctx.stroke();
    
    PLAYER_TEAM.x = x;
    PLAYER_TEAM.y = y;
    
    for (k=0;k < PLAYER_TEAM.length;k++){
        PLAYER_TEAM.members[k].x = PLAYER_TEAM.x;
        PLAYER_TEAM.members[k].y = PLAYER_TEAM.y;
    }
}

function drawFood(x,y,sight){
    var c = document.getElementById("Map");
    var ctx = c.getContext("2d");
    ctx.beginPath();
    ctx.arc(500/2 + (x-xcent)*(500/(sight*2+1)),
            500/2 + (y-ycent)*(500/(sight*2+1)),
            500/((sight*2+1)*6),0,2*Math.PI);
    ctx.fillStyle = 'yellow';
    ctx.fill();
    ctx.strokeType = 'black';
    ctx.stroke();
};

function drawZombie(x,y,sight){
    var c = document.getElementById("Map");
    var ctx = c.getContext("2d");
    ctx.beginPath();
    ctx.arc(500/2 + (x-xcent)*(500/(sight*2+1)),
            500/2 + (y-ycent)*(500/(sight*2+1)),
            500/((sight*2+1)*3),0,2*Math.PI);
    ctx.fillStyle = 'grey';
    ctx.fill();
    ctx.strokeType = 'black';
    ctx.stroke();
};

function drawSurvivor(x,y,sight){
    var c = document.getElementById("Map");
    var ctx = c.getContext("2d");
    ctx.beginPath();
    ctx.arc(500/2 + (x-xcent)*(500/(sight*2+1)),
            500/2 + (y-ycent)*(500/(sight*2+1)),
            500/((sight*2+1)*3.5),0,2*Math.PI);
    ctx.fillStyle = 'blue';
    ctx.fill();
    ctx.strokeType = 'black';
    ctx.stroke();
};

function drawEntities(sight){
    refreshMap(sight);
    
    drawTeam(0,0,PLAYER_TEAM.sight);
    var len = Math.max(SURVIVOR_GROUP.length,ZOMBIE_GROUP.length);
    
    for (i=0; i < len; i++){
        
        if(i < FOOD_GROUP.length){
            var xbool = FOOD_GROUP[i].x  <= (xcent + sight) &&
                    FOOD_GROUP[i].x >= (xcent - sight);
            var ybool = FOOD_GROUP[i].y  <= (ycent + sight) &&
                        FOOD_GROUP[i].y >= (ycent - sight);
            if(xbool && ybool){
                drawFood(FOOD_GROUP[i].x,FOOD_GROUP[i].y,sight);
            };
        };
        
        if(i < ZOMBIE_GROUP.length){
            var xbool = ZOMBIE_GROUP[i].x  <= (xcent + sight) &&
                    ZOMBIE_GROUP[i].x >= (xcent - sight);
            var ybool = ZOMBIE_GROUP[i].y  <= (ycent + sight) &&
                        ZOMBIE_GROUP[i].y >= (ycent - sight);
            if(xbool && ybool){
                drawZombie(ZOMBIE_GROUP[i].x,ZOMBIE_GROUP[i].y,sight);
            };
        };
        if(i < SURVIVOR_GROUP.length){
            var xbool = SURVIVOR_GROUP[i].x  <= (xcent + sight) &&
                    SURVIVOR_GROUP[i].x >= (xcent - sight);
            var ybool = SURVIVOR_GROUP[i].y  <= (ycent + sight) &&
                        SURVIVOR_GROUP[i].y >= (ycent - sight);
            if(xbool && ybool){
                drawSurvivor(SURVIVOR_GROUP[i].x,SURVIVOR_GROUP[i].y,sight);
            };
        }
    };
    /*xbool = FOOD_GROUP[200].x  <= (xcent + sight) &&
                    FOOD_GROUP[200].x >= (xcent - sight);
    ybool = FOOD_GROUP[200].y  <= (ycent + sight) &&
                    FOOD_GROUP[200].y >= (ycent - sight);
    console.log("fx :" + FOOD_GROUP[200].x + ", fy: " + FOOD_GROUP[200].y);
    console.log("xbool: " + xbool);
    console.log("ybool: " + ybool);
    console.log("xcent: " + xcent);
    console.log("Sight: " + sight);*/
};

function theHunger(){
    total_hours++;
    var len = Math.max(PLAYER_TEAM.members.length,SURVIVOR_GROUP.length);
    if (total_hours % steps_per_day == 0) {
        for(i=0; i < len;i++){
            if (i < SURVIVOR_GROUP.length) {
                SURVIVOR_GROUP[i].health = SURVIVOR_GROUP[i].health - 1;
                if (SURVIVOR_GROUP[i].health <= 0) {
                    SURVIVOR_GROUP[i].zombify();
                }
            }
            if (i < PLAYER_TEAM.members.length) {
                PLAYER_TEAM.members[i].health = PLAYER_TEAM.members[i].health - 1;
                if (PLAYER_TEAM.members[i].health <= 0) {
                    PLAYER_TEAM.zombify(PLAYER_TEAM.members[i]);
                }
            };
        };
    };
    console.log("Total Days: " + Math.round(total_hours/24));
    console.log("x: " + PLAYER_TEAM.x + ", y: " + PLAYER_TEAM.y);
    PLAYER_TEAM.isGameOver();
    drawMiniMap();
};

function travelNorth(){
    if(PLAYER_TEAM.y != (-HEIGHT+1)){
        drawTeam(0,-1,PLAYER_TEAM.sight);
        drawEntities(PLAYER_TEAM.sight);
        teamCollide(PLAYER_TEAM.x,PLAYER_TEAM.y);
        survivorCollide();
        moveEntities();
        displayTeam();
        theHunger();
        //console.log("North");
    }
};

function travelSouth(){
    if(PLAYER_TEAM.y != (HEIGHT-1)){
       drawTeam(0,1,PLAYER_TEAM.sight);
        drawEntities(PLAYER_TEAM.sight);
        teamCollide(PLAYER_TEAM.x,PLAYER_TEAM.y);
        survivorCollide();
        moveEntities();
        displayTeam();
        theHunger();
        //console.log("South"); 
    }
};

function travelEast(){
    if(PLAYER_TEAM.x != (WIDTH-1)){
        drawTeam(1,0,PLAYER_TEAM.sight);
        drawEntities(PLAYER_TEAM.sight);
        teamCollide(PLAYER_TEAM.x,PLAYER_TEAM.y);
        survivorCollide();
        moveEntities();
        displayTeam();
        theHunger();
        //console.log("East");
    }
};

function travelWest(){
    if(PLAYER_TEAM.x != (-WIDTH+1)){
        drawTeam(-1,0,PLAYER_TEAM.sight);
        drawEntities(PLAYER_TEAM.sight);
        teamCollide(PLAYER_TEAM.x,PLAYER_TEAM.y);
        survivorCollide();
        moveEntities();
        displayTeam();
        theHunger();
        //console.log("West");
    }
};

function sortTeamOnFood(){
    PLAYER_TEAM.members.sort(function(a,b){
        return a.food - b.food;});
};

function sortTeamOnStrength(){
    PLAYER_TEAM.members.sort(function(a,b){
        return b.str - a.str;});
}

function sortTeamOnHealth(){
    PLAYER_TEAM.members.sort(function(a,b){
        return b.health - a.health;});
}

function sortTeamOnImmunity(){
    PLAYER_TEAM.members.sort(function(a,b){
        return b.immun - a.immun;});
}

function leaveTheInfected(){
    var len = PLAYER_TEAM.members.length;
    for(i =0; i < len;i++){
        if(PLAYER_TEAM.members[i].infected){
            alert(PLAYER_TEAM.members[i].name + " has been deserted!");
            PLAYER_TEAM.removeMember(PLAYER_TEAM.members[i]);
            resetKeys();
        };
        if(len != PLAYER_TEAM.members.length){
            len = PLAYER_TEAM.members.length;
            i=0;
        }
    };
};

function runGame(){
    if(SURVIVOR_GROUP.length == 0 && FOOD_GROUP.length == 0 &&
       ZOMBIE_GROUP == 0 && PLAYER_TEAM.members.length == 0){
        /*var firstname = prompt("Please enter your first name:", "James");
        var lastname = prompt("Please enter your last name:", "Carregan");
        var sex = prompt("Are you male or female?", "Male");
        if(sex.toUpperCase() == "MALE"){
            sex = "Male";
        } else {
            sex = "Female";
        }*/
        var firstname = "James";
        var lastname = "Carregan";
        var sex = "Male";
        PLAYER_TEAM.addMember(
            new Survivor(0,firstname,lastname,sex,32,70,5,100,5,100,0,0)
            );
        console.log(ZOMBIE_GROUP.length);
        init_players();
        //getStatus();
        document.getElementById("TeamTitle").innerHTML = "Survivor Group";
        displayTeam();
        displayInstructions();
        document.getElementById("InstructionsTitle").innerHTML = "Instructions";
        drawMap();
        drawMiniMap();
        drawTeam(0,0,PLAYER_TEAM.sight);
        FOOD_GROUP.push(new Food(10,1,1));
        drawEntities(PLAYER_TEAM.sight);
    };
};


onkeydown = onkeyup = function(e){
    
    e = e || event; // to deal with IE
    
    keys[e.keyCode] = e.type == 'keydown';
    
    /*insert conditional here*/
    if (keys[37]){ // left
        travelWest();
        resetKeys();
    } else if (keys[38]){ // up
        travelNorth();
        resetKeys();
    } else if (keys[39]){ // right
        travelEast();
        resetKeys();
    } else if (keys[40]){ // down
        travelSouth();
        resetKeys();
    } else if (keys[83]){ // S Key
        sortTeamOnStrength();
        resetKeys();
        displayTeam();
    } else if (keys[70]){ // F Key
        sortTeamOnFood();
        resetKeys();
        displayTeam();
    } else if (keys[69]){ // E Key
        PLAYER_TEAM.consumeFood();
        resetKeys();
        displayTeam();
    } else if (keys[76]){ // L Key
        leaveTheInfected();
        resetKeys();
        displayTeam();
    } else if (keys[73]){ // I Key
        sortTeamOnImmunity();
        resetKeys();
        displayTeam();
    } else if (keys[72]){ // H Key
        sortTeamOnHealth();
        resetKeys();
        displayTeam();
    }
};
