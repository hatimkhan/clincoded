'use strict';
import React, { Component } from 'react';
import createReactClass from 'create-react-class';
import _ from 'underscore';
import moment from 'moment';
import { curator_page, userMatch, external_url_map } from './globals';
import { RestMixin } from './rest';
import { Form, FormMixin, Input } from '../libs/bootstrap/form';
import { Panel } from '../libs/bootstrap/panel';
import { parseAndLogError } from './mixins';
import * as CuratorHistory from './curator_history';
import { showActivityIndicator } from './activity_indicator';

var fetched = require('./fetched');

var Dashboard = createReactClass({
    mixins: [RestMixin, CuratorHistory],

    getInitialState: function() {
        return {
            userName: '',
            userStatus: '',
            lastLogin: '',
            gdmListLoading: true,
            vciInterpListLoading: true,
            historiesLoading: true,
            gdmList: [],
            vciInterpList: [],
            histories: []
        };
    },

    cleanGdmGeneDiseaseName: function(gene, disease) {
        return gene + "–" + disease;
    },

    cleanHpoName: function(term) {
        // remove (HP:#######) from model name
        return term.indexOf('(') > -1 ? term.substring(0, term.indexOf('(') - 1) : term;
    },

    setUserData: function(props) {
        // sets the display name and curator status
        this.setState({
            userName: props.first_name,
            userStatus: props.job_title,
            lastLogin: ''
        });
    },

    getData: function(session) {
        // get 10 gdms and VCI interpretations created by user
        this.getRestDatas([
            '/search/?type=gdm&submitted_by.uuid=' + session.user_properties.uuid,
            '/search/?type=interpretation&submitted_by.uuid=' + session.user_properties.uuid
        ],
            null)
        .then(data => {
            var gdmURLs = [], gdmList = [],
                vciInterpURLs = [], vciInterpList = [];
            // go through GDM results and get their data
            gdmURLs = data[0]['@graph'].map(res => { return res['@id']; });
            if (gdmURLs.length > 0) {
                this.getRestDatas(gdmURLs, null, true).then(gdmResults => {
                    gdmResults.map(gdmResult => {
                        gdmList.push({
                            uuid: gdmResult.uuid,
                            gdmGeneDisease: this.cleanGdmGeneDiseaseName(gdmResult.gene.symbol, gdmResult.disease.term),
                            gdmModel: this.cleanHpoName(gdmResult.modeInheritance),
                            status: gdmResult.gdm_status,
                            date_created: gdmResult.date_created
                        });
                    });
                    this.setState({gdmList: gdmList, gdmListLoading: false});
                });
            } else {
                this.setState({gdmListLoading: false});
            }
            // go through VCI interpretation results and get their data
            vciInterpURLs = data[1]['@graph'].map(res => { return res['@id']; });
            if (vciInterpURLs.length > 0) {
                this.getRestDatas(vciInterpURLs, null, true).then(vciInterpResults => {
                    vciInterpResults.map(vciInterpResult => {
                        vciInterpList.push({
                            uuid: vciInterpResult.uuid,
                            variantUuid: vciInterpResult.variant.uuid,
                            clinvarVariantTitle: vciInterpResult.variant.clinvarVariantTitle,
                            hgvsName37: vciInterpResult.variant.hgvsNames && vciInterpResult.variant.hgvsNames.GRCh37 ? vciInterpResult.variant.hgvsNames.GRCh37 : null,
                            hgvsName38: vciInterpResult.variant.hgvsNames && vciInterpResult.variant.hgvsNames.GRCh38 ? vciInterpResult.variant.hgvsNames.GRCh38 : null,
                            diseaseTerm: vciInterpResult.disease ? vciInterpResult.disease.term : null,
                            modeInheritance: vciInterpResult.modeInheritance ? this.cleanHpoName(vciInterpResult.modeInheritance) : null,
                            status: vciInterpResult.interpretation_status,
                            date_created: vciInterpResult.date_created
                        });
                    });
                    this.setState({vciInterpList: vciInterpList, vciInterpListLoading: false});
                });
            } else {
                this.setState({vciInterpListLoading: false});
            }
        }).catch(parseAndLogError.bind(undefined, 'putRequest'));
    },

    componentDidMount: function() {
        if (this.props.session.user_properties) {
            this.setUserData(this.props.session.user_properties);
            this.getData(this.props.session);
        }
        this.getHistories(this.props.session.user_properties, 10).then(histories => {
            if (histories) {
                this.setState({histories: histories, historiesLoading: false});
            }
        });
    },

    componentWillReceiveProps: function(nextProps) {
        if (nextProps.session.user_properties && nextProps.href.indexOf('dashboard') > -1 && !_.isEqual(nextProps.session.user_properties, this.props.session.user_properties)) {
            this.setUserData(nextProps.session.user_properties);
            this.getData(nextProps.session);
            this.getHistories(nextProps.session.user_properties, 10).then(histories => {
                if (histories) {
                    this.setState({histories: histories, historiesLoading: false});
                }
            });
        }
    },

    render: function() {
        return (
            <div className="container">
                <h1>Welcome, {this.state.userName}!</h1>
                <h4>Your status: {this.state.userStatus}</h4>
                <div className="row">
                    <div className="col-md-6">
                        <Panel panelClassName="panel-dashboard">
                            <h3>Tools</h3>
                            <ul>
                                <li>
                                    <a href="/select-variant/">Select Variant for Variant Curation</a>
                                    <a className="help-doc" href="/static/help/clingen-variant-curation-help.pdf" title="Variant Curation Help" target="_blank">
                                        <i className="icon icon-question-circle"></i>
                                    </a>
                                </li>
                                <li><a href="/interpretations/">View list of all Variant Interpretations</a></li>
                                <li>
                                    <a href="/create-gene-disease/">Create Gene-Disease Record</a>
                                    <a className="help-doc" href="/static/help/clingen-gene-curation-help.pdf" title="Gene Curation Help" target="_blank">
                                        <i className="icon icon-question-circle"></i>
                                    </a>
                                </li>
                                <li><a href="/gdm/">View list of all Gene-Disease Records</a></li>
                            </ul>
                        </Panel>
                        <Panel panelClassName="panel-dashboard">
                            <h3>Your Recent History</h3>
                            <div className="panel-content-wrapper">
                                {this.state.historiesLoading ? showActivityIndicator('Loading... ') : null}
                                {this.state.histories.length ?
                                    <ul>
                                        {this.state.histories.map(history => {
                                            // Call the history display view based on the primary object
                                            var HistoryView = this.getHistoryView(history);
                                            return <li key={history.uuid}><HistoryView history={history} user={this.props.session && this.props.session.user_properties} /></li>;
                                        })}
                                    </ul>
                                :
                                    <li>You have no activity to display.</li>
                                }
                            </div>
                        </Panel>
                    </div>
                    <div className="col-md-6">
                        <Panel panelClassName="panel-dashboard">
                            <h3>Your Variant Interpretations</h3>
                            <div className="panel-content-wrapper">
                                {this.state.vciInterpListLoading ? showActivityIndicator('Loading... ') : null}
                                {this.state.vciInterpList.length > 0 ?
                                <ul>
                                    {this.state.vciInterpList.map(function(item) {
                                        return (
                                        <a key={item.uuid} className="block-link" href={"/variant-central/?edit=true&variant=" + item.variantUuid + "&interpretation=" + item.uuid}>
                                        <li key={item.uuid}>
                                            <div><span className="block-link-color title-ellipsis"><strong>
                                            {item.clinvarVariantTitle
                                                ? item.clinvarVariantTitle
                                                : (item.hgvsName38 ? item.hgvsName38 : item.hgvsName37)
                                            }
                                            </strong></span></div>
                                            <span className="block-link-no-color title-ellipsis">
                                                <strong>Disease</strong>: {item.diseaseTerm ? item.diseaseTerm : "None added"}
                                                <br /><strong>Mode of Inheritance</strong>: {item.modeInheritance ? <i>{item.modeInheritance}</i> : "None added"}
                                                <br /><span className="block-link-no-color"><strong>Status</strong>: {item.status}
                                                <br /><strong>Creation Date</strong>: {moment(item.date_created).format("YYYY MMM DD, h:mm a")}</span>
                                            </span>
                                        </li>
                                        </a>
                                        );
                                    })}
                                </ul>
                                : <li>You have not created any variant interpretations.</li>}
                            </div>
                        </Panel>

                        <Panel panelClassName="panel-dashboard">
                            <h3>Your Gene-Disease Records</h3>
                            <div className="panel-content-wrapper">
                                {this.state.gdmListLoading ? showActivityIndicator('Loading... ') : null}
                                {this.state.gdmList.length > 0 ?
                                <ul>
                                    {this.state.gdmList.map(function(item) {
                                        return (
                                        <a key={item.uuid} className="block-link" href={"/curation-central/?gdm=" + item.uuid}>
                                        <li key={item.uuid}>
                                            <div><span className="block-link-color title-ellipsis"><strong>{item.gdmGeneDisease}</strong>–<i>{item.gdmModel}</i></span></div>
                                            <span className="block-link-no-color"><strong>Status</strong>: {item.status}<br />
                                            <strong>Creation Date</strong>: {moment(item.date_created).format("YYYY MMM DD, h:mm a")}</span>
                                        </li>
                                        </a>
                                        );
                                    })}
                                </ul>
                                : <li>You have not created any Gene-Disease-Mode of Inheritance entries.</li>}
                            </div>
                        </Panel>
                    </div>
                </div>
            </div>
        );
    }
});

curator_page.register(Dashboard, 'curator_page', 'dashboard');
