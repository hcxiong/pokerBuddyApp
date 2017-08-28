import React, { Component } from 'react';
import {
  Text, View, TextInput, AsyncStorage, Picker, TouchableOpacity, StatusBar, ScrollView, Image
} from 'react-native';

import Modal from 'react-native-modal';
import styles from '../Styles';
import * as utils from '../UtilFunctions';
import Button from '../components/Button';
import IconButton from '../components/IconButton';
import SafeImage from '../components/SafeImage';
import ListPicker from '../components/ListPicker';

export default class HomeView extends Component {

	static navigationOptions = {
		title: 'POCAT v0.2'
	}

	constructor(props){
		super(props);
		const {navigation} = props;
		this.state = {
			navigation: navigation,
			token: navigation.state.params.token,
			user: navigation.state.params.user,
			game_identifier: '',
			active_games: [],
			past_games: [],
			isModalVisible: false,
			min_bet: 20,
			new_venmo_username: navigation.state.params.user.venmo_username,
			modalType: '',
			errorLabel: '',
		};

		this.getActiveGames();
		this.getPastGames();

		this.getPushToken(navigation.state.params.user);
		
	}

	//TODO: remove this after implemented in registration
	//need to test on iOS and make sure it works perferctly
	async getPushToken(user){
		if (!user.push_token){
			response = await utils.registerForPushNotificationsAsync(user.id);
			await AsyncStorage.setItem('@pokerBuddy:user', JSON.stringify(response.user));
		}
	}
	
	async createGame(navigation){
		//TODO: handle network error
		if (this.state.min_bet === '' || this.state.token === '' || this.state.token === 'no token'){
			return;
		}
		const response = await utils.fetchFromServer('games/','POST',{
			min_bet: this.state.min_bet
		},this.state.token);

		//game created succesfully
		if (response.status===201){
			//get new game identifier
			let game_json = JSON.parse(response._bodyText);
			let game_identifier = game_json.identifier;
			
			//TODO: add option for host not to immediately join game
			//join game
			game = await utils.joinGame(game_identifier,this.state.token,this.state.user);
			this.setState({isModalVisible:false});
			this.updateActiveGames(game.identifier);
			utils.resetToScreen(navigation,"GameView",{game: game,user: this.state.user,token:this.state.token});
		}
		//TODO:else
		
	}

	updateActiveGames(identifier) {
		let active_games = this.state.active_games;
		active_games.push({game:identifier});
		this.setState({active_games:active_games});
	}

	_renderModalContent = () => {
		switch(this.state.modalType){
			case 'CreateGame':
				navigation = this.state.navigation;
			    return (
			      <View style={styles.modalContent}>
			      	<Text style={styles.textSubheader}>Starting bet</Text>
			      	<View style={styles.inputContainer}>
				      	<TextInput
				      		style={styles.transparentTextinput}
				      		border={true}
				      		onChangeText={(text)=>{this.setState({min_bet:text})}}
				      		value={this.state.min_bet.toString()}
				      		selectTextOnFocus={true}
				      		autoFocus={true}
				      		keyboardType={'numeric'}
				      		onSubmitEditing={()=>{this.createGame(navigation)}}
							underlineColorAndroid="transparent"
			      		/>
		      		</View>
			        <View style={{flexDirection:'row'}}>
			        	<IconButton action={()=> this.setState({isModalVisible:false})} name="ios-close-circle-outline" text="Cancel" />
			        	<IconButton action={()=> this.createGame(navigation)} name="ios-checkmark-circle-outline" text="Create" />
					</View>
			      </View>
			    );
		    case 'UpdateVenmo':
		    	return (
			      <View style={styles.modalContent}>
			      	<Text style={styles.textSubheader}>Update Vemno</Text>
			      	<View style={styles.inputContainer}>
				      	<TextInput
				      		style={styles.textinputwide}
				      		onChangeText={(text)=>{this.setState({new_venmo_username:text})}}
				      		value={this.state.new_venmo_username}
				      		selectTextOnFocus={true}
				      		autoFocus={true}
				      		placeholder='Account username (without the @)'
				      		onSubmitEditing={()=>{this.updateVenmo()}}
				      		underlineColorAndroid="transparent"
			      		/>
		      		</View>
			        <View style={{flexDirection:'row'}}>
			        	<IconButton action={()=> this.setState({isModalVisible:false})} name="ios-close-circle-outline" text="Cancel" />
			        	<IconButton action={()=> this.updateVenmo()} name="ios-checkmark-circle-outline" text="Confirm" />
					</View>
			      </View>
			    );
		    case 'JoinGame':
		    	return (
		    		<View style={styles.modalContent}>
		    			<View style={styles.inputContainer}>
				    		<TextInput
					      		style={styles.transparentTextinput}
					      		onChangeText={(text)=>{this.setState({game_identifier:text})}}
					      		value={this.state.game_identifier}
					      		autoCapitalize={'characters'}
					      		selectTextOnFocus={true}
					      		maxLength={5}
					      		placeholder='Game Address'
					      		underlineColorAndroid="transparent"
				      		/>
			      		</View>
			      		<Text style={styles.errorLabel}>{this.state.errorLabel}</Text>
			      		<View style={{flexDirection:'row'}}>
			      			<IconButton action={()=> this.setState({isModalVisible:false})} name="ios-close-circle-outline" text="Cancel" />
			        		<IconButton action={async ()=>{
					        	//TODO: better generic error handling
					        	
					        	//join game
					        	game = await utils.joinGame(this.state.game_identifier,this.state.token,this.state.user);
					        	if (game.error){
					        		this.setState({errorLabel:game.error});
					        		return;
					        	}

					        	//check if game is already in active games list
					        	let active_games = this.state.active_games;
					        	let game_already_active = active_games.find((elem)=>{return elem.game == this.state.game_identifier});
					        	
					        	if(game_already_active == null){
					        		//if not there, add to it
				        			this.updateActiveGames(game.identifier);
					        	}

					        	this.setState({isModalVisible:false});
					        	utils.resetToScreen(navigation,"GameView",{game: game,user: this.state.user,token:this.state.token});
					        }} name="ios-checkmark-circle-outline" text="Join" />
				        </View>
			        </View>
	    		);
		    case 'BackToPrev':
		    	return (
		    		<View style={styles.modalContent}>
		    			<ListPicker
							containerStyle={{width:200,maxHeight:375}} 
							optionArray={this.state.active_games}
							keyExtractor={(l,i)=>l.game}
							onPressElement={(l,i)=> async ()=>{
					        	//TODO: check all this occuronces for errors!
					        	game = await utils.joinGame(l.game,this.state.token,this.state.user);
					        	this.setState({isModalVisible:false});
					        	utils.resetToScreen(navigation,"GameView",{game: game,user: this.state.user,token:this.state.token});
					        }}
					        textExtractor={this.gameDateExtractor}
						/>
		    			<View style={{flexDirection:'row'}}>
			      			<IconButton action={()=> this.setState({isModalVisible:false})} name="ios-close-circle-outline" text="Cancel" />
				        </View>
			        </View>
	    		);
    		case 'BackToPast':
		    	return (
		    		<View style={styles.modalContent}>
		    			<ListPicker
							containerStyle={{width:200,maxHeight:375}} 
							optionArray={this.state.past_games}
							keyExtractor={(l,i)=>l.game}
							onPressElement={(l,i)=> async ()=>{
					        	//TODO: check all this occuronces for errors!
					        	game = await utils.joinGame(l.game,this.state.token,this.state.user);
					        	this.setState({isModalVisible:false});
					        	utils.resetToScreen(navigation,"GameView",{game: game,user: this.state.user,token:this.state.token});
					        }}
					        textExtractor={this.gameDateExtractor}
						/>
		    			<View style={{flexDirection:'row'}}>
			      			<IconButton action={()=> this.setState({isModalVisible:false})} name="ios-close-circle-outline" text="Cancel" />
				        </View>
			        </View>
	    		);
		    default:
				return (<View><Text>Error</Text></View>);
		}
	}

	gameDateExtractor(l,i) {
		let date = new Date(l.created_at);
    	let hour = date.getHours();
    	hour = (hour < 12) ? hour + "am" : ((hour==12)? hour + "pm" : (hour-12) + "pm");
    	let dateStr = (date.getMonth()+1) + "/" + date.getDate() + "/" + date.getFullYear() + " " + hour;
    	return <Text style={styles.textSubheader} >{dateStr}</Text>
	}

	async getActiveGames(){
		const response = await utils.fetchFromServer(
			'users/' + this.state.user.id + '/active_games/',
			'GET',
			null,
			this.state.token
		);
		if (response.status===200){
			let response_json = JSON.parse(response._bodyText);
			this.setState({active_games:response_json});
		}
	}

	async getPastGames(){
		const response = await utils.fetchFromServer(
			'users/' + this.state.user.id + '/past_games/',
			'GET',
			null,
			this.state.token
		);
		if (response.status===200){
			let response_json = JSON.parse(response._bodyText);
			this.setState({past_games:response_json});
		}
	}

	async updateVenmo(){
		const response = await utils.fetchFromServer(
			'users/' + this.state.user.id + '/update_venmo/',
			'POST',
			{
				venmo_username:this.state.new_venmo_username
			},
			this.state.token
		);
		this.setState({isModalVisible:false});
	}

	async logout(){
		await AsyncStorage.multiRemove(['@pokerBuddy:token','@pokerBuddy:user']);
		utils.resetToScreen(this.state.navigation,'LoginView');
	}

	render() {
		navigation = this.state.navigation;
		
		let active_games = this.state.active_games;
		let prevGameColor = null;
		let prevGameAction = null;
		if (active_games.length > 0){
			prevGameAction = ()=>{this.setState({isModalVisible:true,modalType:'BackToPrev'})};
		} else {
			prevGameAction = ()=>{};
			prevGameColor = '#ccc';
		}
		let prevGameButton = (<IconButton name="ios-log-in" text='Rejoin Game' action={prevGameAction} color={prevGameColor} />);

		let past_games = this.state.past_games;
		let pastGameColor = null;
		let pastGameAction = null;
		if (past_games.length > 0){
			pastGameAction = ()=>{this.setState({isModalVisible:true,modalType:'BackToPast'})};
		} else {
			pastGameAction = ()=>{};
			pastGameColor = "#ccc";
		}
		let pastGameButton = (<IconButton name="ios-timer-outline" text='Past Games' action={pastGameAction} color={pastGameColor} />);

		
		return (
	      <View style={styles.container}>
	      	{/*Headers*/}
	      	<StatusBar hidden={true} />
	      	<Modal isVisible={this.state.isModalVisible === true}>
				{this._renderModalContent()}
	        </Modal>
	        <Image source={{uri:'https://s3.amazonaws.com/pokerbuddy/images/pocat_logo_text.png'}} style={{width:300,height:130}} /> 
	        <View style={{flexDirection:'row'}}>
		        <IconButton name="ios-add-circle-outline" text="Create Game" action={()=>{this.setState({isModalVisible:true,modalType:'CreateGame'})}} />
		        <IconButton name="ios-people-outline" text='Join Game' action={()=>{this.setState({errorLabel:'',isModalVisible:true,modalType:'JoinGame'})}} />
	        </View>
	        <View style={{flexDirection:'row'}}>
		      	{prevGameButton}
		      	{pastGameButton}
	      	</View>
	      	
	      	<View style={{borderColor:'#ffccbb' ,borderWidth:1 ,borderRadius:12,padding:10,marginTop:20}}>
	        	<View style={{flexDirection:'row', justifyContent:'center', alignItems:'center'}} >
	        		<SafeImage uri={this.state.user.picture_url} style={{width:30,height:30,borderWidth:0,borderRadius:12,borderColor:'white',margin:10}} />
	        		<Text style={styles.textSubheader}>{this.state.user.first_name + " " + this.state.user.last_name}</Text>
	        	</View>
	        	<View style={{flexDirection:'row'}}>
			      	<IconButton name="ios-create-outline" text="Update Venmo" size={25} action={()=>{this.setState({isModalVisible:true,modalType:'UpdateVenmo'})}} />
			      	<IconButton name="ios-exit-outline" text='Logout' size={25} action={()=>this.logout()} />
		      	</View>
	        </View>

	      </View>
	    );
	}

}
