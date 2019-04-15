import React, { Component } from 'react';

class Menu extends Component {
  constructor(props) {
    super(props)
  }

  render() {
    return (
      <div className="menuZone">
        <div className="menu">
          <div className="clickToChangeApp"></div>
          <div className="clickToFriends"></div>
          <div className="clickToSettings"></div>
          <div className="clickToLogoutAndClose">
            <div className="clickToLogout">
              <div 
                className="logoutViewButton"
                role="logoutViewButton" 
                onClick={this.props.changeToLogoutViewStatus}>Sign In
              </div>
            </div>
            <div className="clickToClose"></div>
          </div>
        </div>
        <div className="showZone">
          <div className="menuUserName">this.props.userName</div>
          <div className="menuAvatar"></div>
        </div>
      </div>
    );
  }
}

export default Menu;