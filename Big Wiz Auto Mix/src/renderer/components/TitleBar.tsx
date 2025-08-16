import React from 'react';
import styled from 'styled-components';

const TitleBarContainer = styled.div`
  height: 32px;
  background: linear-gradient(180deg, #3a3a3a 0%, #2a2a2a 100%);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-bottom: 1px solid #444;
  -webkit-app-region: drag;
  user-select: none;
`;

const TitleText = styled.div`
  font-size: 13px;
  font-weight: 500;
  color: #ffffff;
  letter-spacing: 0.5px;
`;

const WindowControls = styled.div`
  display: flex;
  gap: 8px;
  -webkit-app-region: no-drag;
`;

const ControlButton = styled.button`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  
  &.close {
    background: #ff5f57;
  }
  
  &.minimize {
    background: #ffbd2e;
  }
  
  &.maximize {
    background: #28ca42;
  }
  
  &:hover {
    opacity: 0.8;
  }
`;

const TitleBar: React.FC = () => {
  return (
    <TitleBarContainer>
      <WindowControls>
        <ControlButton className="close" />
        <ControlButton className="minimize" />
        <ControlButton className="maximize" />
      </WindowControls>
      <TitleText>Big Wiz Auto Mix</TitleText>
      <div />
    </TitleBarContainer>
  );
};

export default TitleBar;